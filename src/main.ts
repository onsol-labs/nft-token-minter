import * as config from "./config";
import * as fs from "fs";
import { setTimeout } from "timers/promises";
import {
    dedupWallets,
    mintNewNFT,
    mintTokensToOnePubkey,
    nftMultiMinter,
    readCSVFile,
    tokenMultiMinter,
    walletAmountType,
} from "./utils";
import { PublicKey } from "@solana/web3.js";

import wallets from "../data/wallets.json";

// uncomment the code step by step.
async function main() {
    /// 0.0 yarn install
    /// 0.a CHECK all the data in .env and constants.ts
    /// 0.b create a new wallet and save it wallet/keypair.json.
    /// 0.c make sure the images/background.jpg is correct - it is going to be the nft background

    /// 1.a TEST airdrop to one pubkey (string)
    //await mintTokensToOnePubkey(await mintNewNFT(), "Gm4FvmDqQxNCqRdmynNknqdYcMwitLMfqY8aLFaxDwSq")

    /// 1. MINT NFTs
    console.log(wallets);

    // await mintNewNFT(new PublicKey("Gm4FvmDqQxNCqRdmynNknqdYcMwitLMfqY8aLFaxDwSq"))

    //console.log(config.MINT_AUTHORITY.publicKey);
    await nftMultiMinter(wallets);
}

main();
