import { BundlerClient, estimateUserOperationGas, UserOperation } from "permissionless";
import { Address, encodeAbiParameters, encodeFunctionData, Hex, keccak256 } from "viem";
import { estimateFeesPerGas, getBytecode, readContract } from "viem/actions";
import { accountAbi, entryPointAbi, entryPointAddress } from "../generated";
import { buildEOADummySignature } from "./signature";
import { getInitCode, PASSKEY_OWNER_DUMMY_SIGNATURE } from "./smartWallet";

export async function buildReplayableUserOp(
  client: BundlerClient,
  {
    account,
    signers,
    calls,
    passkeySigner = true,
  }: {
    account: Address;
    signers: Hex[];
    calls: Hex[];
    passkeySigner?: boolean;
  },
): Promise<UserOperation> {
  let initCode: Hex = "0x";
  const code = await getBytecode(client, { address: account });
  if (!code) {
    initCode = getInitCode({
      owners: signers,
      index: 0n,
    });
  }

  const callData = executeWithoutChainIdValidationCalldata({ calls });
  const nonce = await readContract(client, {
    address: entryPointAddress,
    abi: entryPointAbi,
    functionName: "getNonce",
    args: [account, 8453n],
  });
  let maxFeesPerGas = await estimateFeesPerGas(client);

  const op = {
    sender: account,
    nonce,
    initCode,
    callData,
    paymasterAndData: "0x" as Hex,
    signature: passkeySigner ? PASSKEY_OWNER_DUMMY_SIGNATURE : buildEOADummySignature({ ownerIndex: 0n }),
    preVerificationGas: 1_000_000n,
    verificationGasLimit: 1_000_000n,
    callGasLimit: 1_000_000n,
    ...maxFeesPerGas,
  };

  const gasLimits = await estimateUserOperationGas(client, {
    userOperation: op,
    entryPoint: entryPointAddress,
  });

  return {
    ...op,
    ...gasLimits,
  };
}

export function executeWithoutChainIdValidationCalldata({ calls }: { calls: Hex[] }): Hex {
  return encodeFunctionData({
    abi: accountAbi,
    functionName: "executeWithoutChainIdValidation",
    args: [calls],
  });
}

export function getUserOpHashWithoutChainId({
  userOperation,
}: {
  userOperation: UserOperation;
}): Hex {
  const encodedUserOp = encodeAbiParameters(
    [
      { name: "sender", type: "address" },
      { name: "nonce", type: "uint256" },
      { name: "initCode", type: "bytes32" },
      { name: "callData", type: "bytes32" },
      { name: "callGasLimit", type: "uint256" },
      {
        name: "verificationGasLimit",
        type: "uint256",
      },
      {
        name: "preVerificationGas",
        type: "uint256",
      },
      { name: "maxFeePerGas", type: "uint256" },
      {
        name: "maxPriorityFeePerGas",
        type: "uint256",
      },
      { name: "paymasterAndData", type: "bytes32" },
    ],
    [
      userOperation.sender,
      userOperation.nonce,
      keccak256(userOperation.initCode),
      keccak256(userOperation.callData),
      userOperation.callGasLimit,
      userOperation.verificationGasLimit,
      userOperation.preVerificationGas,
      userOperation.maxFeePerGas,
      userOperation.maxPriorityFeePerGas,
      keccak256(userOperation.paymasterAndData),
    ],
  );
  const hashedUserOp = keccak256(encodedUserOp);
  const encodedWithEntryPoint = encodeAbiParameters(
    [
      { name: "userOpHash", type: "bytes32" },
      { name: "entryPoint", type: "address" },
    ],
    [hashedUserOp, entryPointAddress],
  );
  return keccak256(encodedWithEntryPoint);
}
