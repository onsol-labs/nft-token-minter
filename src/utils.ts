import {
  Transaction,
  SystemProgram,
  TransactionInstruction,
  Keypair,
  Connection,
  PublicKey,
} from "@solana/web3.js";
import {
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
  createInitializeMintInstruction,
  getMinimumBalanceForRentExemptMint,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
} from "@solana/spl-token";
import {
  DataV2,
  createCreateMetadataAccountV3Instruction,
} from "@metaplex-foundation/mpl-token-metadata";
import {
  bundlrStorage,
  keypairIdentity,
  Metaplex,
  UploadMetadataInput,
  toMetaplexFile,
} from "@metaplex-foundation/js";
import * as fs from "fs";
import * as config from './config';
import { DEVNET, MAINNET, TOKEN_DESCRIPTION, TOKEN_NAME, TOKEN_SYMBOL } from "./constants";

import { setTimeout } from "timers/promises";

import csv from 'csv-parser';

export const ON_CHAIN_METADATA = {
  name: config.TOKEN_METADATA.name,
  symbol: config.TOKEN_METADATA.symbol,
  uri: "",
  external_url: "https://alldomains.id",
  sellerFeeBasisPoints: 0,
  creators: null,
  collection: null,
  uses: null,
} as DataV2;

const isDevnet = config.CONNECTION.rpcEndpoint.includes('devnet');

async function uploadMetadata(
  wallet: Keypair,
  imageName?: string,
): Promise<string> {
  let imageFile: any;
  if (imageName) {
    const imageBuffer = fs.readFileSync(`images/${imageName}`);
    imageFile = toMetaplexFile(imageBuffer, `${imageName}`);
  }

  let address = "https://devnet.bundlr.network"
  let providerUrl = DEVNET
  if (!isDevnet) {
    address = "https://node1.bundlr.network/"
    providerUrl = MAINNET
  }


  const metaplex = Metaplex.make(config.CONNECTION)
    .use(keypairIdentity(wallet))
    .use(
      bundlrStorage({
        address: address,
        providerUrl: providerUrl,
        timeout: 60000,
      }),
    );
  const { uri } = await metaplex.nfts().uploadMetadata({
    image: imageFile,
    name: TOKEN_NAME,
    symbol: TOKEN_SYMBOL,
    description: TOKEN_DESCRIPTION,
  });

  console.log(`Arweave METADATA JSON URL: `, uri);
  return uri;
}

async function createNewMintTransaction(
  connection: Connection,
  payer: Keypair,
  mintKeypair: Keypair,
  destinationWallet: PublicKey,
  mintAuthority: PublicKey,
  freezeAuthority: PublicKey,
) {
  const metaplex = Metaplex.make(config.CONNECTION);
  const requiredBalance = await getMinimumBalanceForRentExemptMint(
    connection,
  );

  const metadataPDA = metaplex
    .nfts()
    .pdas()
    .metadata({ mint: mintKeypair.publicKey });

  const tokenATA = await getAssociatedTokenAddress(
    mintKeypair.publicKey,
    destinationWallet,
  );

  const createNewTokenTransaction = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: mintKeypair.publicKey,
      space: MINT_SIZE,
      lamports: requiredBalance,
      programId: TOKEN_PROGRAM_ID,
    }),
    createInitializeMintInstruction(
      mintKeypair.publicKey, // mint account Address
      config.MINT_CONFIG.numDecimals, // number of decimals of the new mint
      mintAuthority, // mint account Authority
      freezeAuthority, // freeze Authority usually mint authority
      TOKEN_PROGRAM_ID,
    ),
    createAssociatedTokenAccountInstruction(
      payer.publicKey, //Payer
      tokenATA, // owner associated token account
      payer.publicKey, // token owner
      mintKeypair.publicKey, // mint account
    ),
    createMintToInstruction(
      mintKeypair.publicKey, // mint account
      tokenATA, // destination associated token account
      mintAuthority, // authority
      config.MINT_CONFIG.numberTokens, //number of tokens
    ),
    createCreateMetadataAccountV3Instruction({
      metadata: metadataPDA,
      mint: mintKeypair.publicKey,
      mintAuthority: mintAuthority,
      payer: payer.publicKey,
      updateAuthority: mintAuthority,
    }, {
      createMetadataAccountArgsV3: {
        data: ON_CHAIN_METADATA,
        isMutable: true,
        collectionDetails: null
      }
    })
  );

  return createNewTokenTransaction;
}

export async function mintNewSFT(destinationWallet: PublicKey = config.MINT_AUTHORITY.publicKey) {
  let metadataUri = await uploadMetadata(
    config.MINT_AUTHORITY,
    "background.jpg",
  );
  ON_CHAIN_METADATA.uri = metadataUri;

  let mintKeypair = Keypair.generate();
  console.log(`token mint address: `, mintKeypair.publicKey.toString());

  const newMintTransaction: Transaction = await createNewMintTransaction(
    config.CONNECTION,
    config.MINT_AUTHORITY,
    mintKeypair,
    destinationWallet,
    config.MINT_AUTHORITY.publicKey,
    config.MINT_AUTHORITY.publicKey,
  );

  const txn_id = await config.CONNECTION.sendTransaction(newMintTransaction, [
    config.MINT_AUTHORITY,
    mintKeypair,
  ]);
  console.log(`transaction: https://solscan.io/tx/${txn_id}${isDevnet ? '?cluster=devnet' : ''} `);
  console.log(
    `token link: https://solscan.io/token/${mintKeypair.publicKey.toString()}${isDevnet ? '?cluster=devnet' : ''}`,
  );
  return mintKeypair.publicKey
}

const mintNewTokensTransaction = async (
  mintPublicKey: PublicKey,
  destinationWallet: PublicKey,
  mintAuthority: PublicKey,
) => {
  const tokenATA = await getAssociatedTokenAddress(
    mintPublicKey,
    destinationWallet,
  );
  const getTokenAta = await config.CONNECTION.getAccountInfo(tokenATA);
  const createNewTokenTransaction = new Transaction();

  if (!getTokenAta) {
    createNewTokenTransaction.add(
      createAssociatedTokenAccountInstruction(
        mintAuthority, //Payer
        tokenATA, // owner associated token account
        destinationWallet, // token owner
        mintPublicKey, // mint account
      ),
    );
  }
  createNewTokenTransaction.add(
    createMintToInstruction(
      mintPublicKey, // mint
      tokenATA, // destination ata
      mintAuthority, // mint authority
      config.MINT_CONFIG.numberTokens, // number of tokens
    ),
  );

  return createNewTokenTransaction;
};

const mintNewTokensInstructions = async (
  mintPublicKey: PublicKey,
  destinationWallet: PublicKey,
  mintAuthority: PublicKey,
  amount: number,
) => {
  const tokenATA = await getAssociatedTokenAddress(
    mintPublicKey,
    destinationWallet,
  );
  const getTokenAta = await config.CONNECTION.getAccountInfo(tokenATA);
  const instructions: TransactionInstruction[] = [];

  if (!getTokenAta) {
    instructions.push(
      createAssociatedTokenAccountInstruction(
        mintAuthority, // payer
        tokenATA, // owner associated token account
        destinationWallet, // token owner
        mintPublicKey, // mint account
      ),
    );
  }
  instructions.push(
    createMintToInstruction(
      mintPublicKey, // mint
      tokenATA, // destination ata
      mintAuthority, // mint authority
      amount, // number of tokens
    ),
  );

  return instructions;
};

export async function mintTokensToOnePubkey(mintPublicKey: PublicKey, userPubkeyString: String) {
  const userPublicKey = new PublicKey(userPubkeyString);
  const mintToTransaction = await mintNewTokensTransaction(
    mintPublicKey,
    userPublicKey,
    config.MINT_AUTHORITY.publicKey,
  );
  const txn_id = await config.CONNECTION.sendTransaction(mintToTransaction, [
    config.MINT_AUTHORITY,
  ]);
  console.log(
    `minted ${config.MINT_CONFIG.numberTokens} ${ON_CHAIN_METADATA.symbol
    } to ${userPublicKey.toString()}.`,
  );
  console.log(`https://solscan.io/tx/${txn_id}${isDevnet ? '?cluster=devnet' : ''}`);
}

export type walletAmountType = {
  wallet: string;
  amount: number;
};

export async function tokenMultiMinter(mintPublicKey: PublicKey, holderWalletArray: walletAmountType[]) {
  let counter = 0;
  const mintNewTokensInstructionsArray: TransactionInstruction[] = [];
  for (const holderWallet of holderWalletArray) {
    const userPublicKey = new PublicKey(holderWallet.wallet);
    const mintNewTokensInstruction = await mintNewTokensInstructions(
      mintPublicKey,
      userPublicKey,
      config.MINT_AUTHORITY.publicKey,
      holderWallet.amount,
    );
    if (mintNewTokensInstruction && mintNewTokensInstruction.length > 0) {
      counter++;
      mintNewTokensInstructionsArray.push(...mintNewTokensInstruction);
    }
    if (counter === 5) {
      const mintToTransaction = new Transaction().add(
        ...mintNewTokensInstructionsArray,
      );

      const txn_id = await config.CONNECTION.sendTransaction(mintToTransaction, [
        config.MINT_AUTHORITY,
      ]);
      console.log(
        `minted ${config.MINT_CONFIG.numberTokens} ${ON_CHAIN_METADATA.symbol
        } to ${userPublicKey.toString()}.`,
      );
      console.log(`https://solscan.io/tx/${txn_id}${isDevnet ? '?cluster=devnet' : ''}`);
      counter = 0;
      mintNewTokensInstructionsArray.length = 0;
    }
    await setTimeout(500);
  }
  if (mintNewTokensInstructionsArray.length > 0) {
    const mintToTransaction = new Transaction().add(
      ...mintNewTokensInstructionsArray,
    );

    const txn_id = await config.CONNECTION.sendTransaction(mintToTransaction, [
      config.MINT_AUTHORITY,
    ]);
    console.log(`https://solscan.io/tx/${txn_id}${isDevnet ? '?cluster=devnet' : ''}`);
  }
  console.log(`minted all ${ON_CHAIN_METADATA.symbol} tokens`);
}

export async function nftMultiMinter(holderWalletArray: walletAmountType[]) {
  let counter = 0;

  let metadataUri = await uploadMetadata(
    config.MINT_AUTHORITY,
    "background.jpg",
  );
  ON_CHAIN_METADATA.uri = metadataUri;

  for (const holderWallet of holderWalletArray) {
    const userPublicKey = new PublicKey(holderWallet.wallet);

    for (let i = 0; i < holderWallet.amount; i++) {

      let mintKeypair = Keypair.generate();
      console.log(`token mint address: `, mintKeypair.publicKey.toString());

      const newMintTransaction: Transaction = await createNewMintTransaction(
        config.CONNECTION,
        config.MINT_AUTHORITY,
        mintKeypair,
        userPublicKey,
        config.MINT_AUTHORITY.publicKey,
        config.MINT_AUTHORITY.publicKey,
      );

      const txn_id = await config.CONNECTION.sendTransaction(newMintTransaction, [
        config.MINT_AUTHORITY,
        mintKeypair,
      ]);
      console.log(`transaction: https://solscan.io/tx/${txn_id}${isDevnet ? '?cluster=devnet' : ''} `);
      console.log(
        `token link: https://solscan.io/token/${mintKeypair.publicKey.toString()}${isDevnet ? '?cluster=devnet' : ''}`,
      );

      counter++;
      await setTimeout(500);
    }
  }
  console.log(`minted all ${counter} tokens`);
}

export function dedupWallets(pubkeyArray: string[]) {
  const walletMap = new Map<string, number>();

  for (const wallet of pubkeyArray) {
    if (walletMap.has(wallet)) {
      walletMap.set(
        wallet,
        walletMap.get(wallet) + config.MINT_CONFIG.numberTokens,
      );
    } else {
      walletMap.set(wallet, config.MINT_CONFIG.numberTokens);
    }
  }

  const walletObjects = Array.from(walletMap.entries()).map(
    ([wallet, amount]) => ({ wallet, amount }),
  );
  walletObjects.sort((a, b) => b.amount - a.amount);
  return walletObjects;
}

export async function readCSVFile(filePath: string, encoding: BufferEncoding = 'utf8'): Promise<object[]> {
  const results: object[] = [];

  return new Promise((resolve, reject) => {
    const stream = fs.createReadStream(filePath, { encoding })
      .on('error', (error) => reject(error));

    stream
      .pipe(csv())
      .on('data', (data) => {
        try {
          // Perform additional validation or transformation of the data here
          results.push(data);
        } catch (error) {
          console.error(`Error processing row: ${error.message}`);
        }
      })
      .on('end', () => resolve(results))
      .on('error', (error: any) => reject(error));
  });
}