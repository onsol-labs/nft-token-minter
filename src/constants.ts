import * as dotenv from "dotenv";
dotenv.config();

// cluster urls
export const MAINNET = process.env.SOLANA_MAINNET_RPC_URL;
export const DEVNET = process.env.SOLANA_DEVNET_RPC_URL;
export const TOKEN_NAME = "MonkeDAO X AllDomains";
export const TOKEN_SYMBOL = "monke";
export const TOKEN_DESCRIPTION = "MonkeDAO token for claiming a .monke domain";
export const TOKEN_METADATA_IMAGE = "";