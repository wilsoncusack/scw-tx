import { encodeFunctionData, parseEther } from "viem";
import { Call } from "../..";
import { magicSpendAbi, magicSpendAddress } from "../../generated";
import { withdrawSignature } from "../../utils/magicSpend";
import { client, getAccount, makeCalls } from "../base";

const asset = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
const amount = 1000n;
const account = await getAccount();
console.log("account", account);
const signature =
  "0xcb0c4e568f76cc24d76d12e8b35807ceedea622612fb809c3ea37be0769373387eb0c3a722a7228358d5157f684c851c11abdc602475b3b30a6966f51cc7aab91c";
const nonce =
  51617215058467874105748217931011252479341335394564786443209829061725680206593n;
const chainId = 8453;
const expiry = 1724285626;
const piggyBankAddress = "0x7BCE4720a302fdCC1Fb9264D52d1b1D05a17b626";
console.log("account", account);

async function main() {
  const functionData = encodeFunctionData({
    abi: magicSpendAbi,
    functionName: "withdraw",
    args: [
      {
        signature: signature,
        asset,
        amount,
        nonce,
        expiry,
      },
    ],
  });
  const calls: Call[] = [
    {
      index: 0,
      target: piggyBankAddress,
      data: functionData,
      value: 0n,
    },
  ];
  makeCalls(calls);
}

main();
