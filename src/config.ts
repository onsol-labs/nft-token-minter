import { Connection, Keypair } from "@solana/web3.js";
import { TOKEN_DESCRIPTION, DEVNET, MAINNET, TOKEN_METADATA_IMAGE, TOKEN_SYMBOL, TOKEN_NAME } from "./constants";
import { UploadMetadataInput } from "@metaplex-foundation/js";
import rawKeypair from '../wallet/keypair.json';

// connection
export const CONNECTION = new Connection(DEVNET, 'confirmed');

// SEMI-FUNGIBLE MINT CONFIG
export const MINT_CONFIG = {
  numDecimals: 0,
  numberTokens: 1,
};

export const TOKEN_METADATA: UploadMetadataInput = {
  name: TOKEN_NAME,
  symbol: TOKEN_SYMBOL,
  description: TOKEN_DESCRIPTION,
  image: TOKEN_METADATA_IMAGE,
};

export const MINT_AUTHORITY = Keypair.fromSecretKey(new Uint8Array(rawKeypair));
