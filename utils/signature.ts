import { base64urlnopad } from "@scure/base";
import {
  decodeAbiParameters,
  encodeAbiParameters,
  encodePacked,
  type Hex,
  hexToBigInt,
  hexToBytes,
  sha256,
  stringToBytes,
  stringToHex,
} from "viem";
import { sign, SignReturnType } from "viem/accounts";

const WebAuthnAuthStruct = {
  components: [
    {
      name: "authenticatorData",
      type: "bytes",
    },
    { name: "clientDataJSON", type: "bytes" },
    { name: "challengeIndex", type: "uint256" },
    { name: "typeIndex", type: "uint256" },
    {
      name: "r",
      type: "uint256",
    },
    {
      name: "s",
      type: "uint256",
    },
  ],
  name: "WebAuthnAuth",
  type: "tuple",
};

const SignatureWrapperStruct = {
  components: [
    {
      name: "ownerIndex",
      type: "uint8",
    },
    {
      name: "signatureData",
      type: "bytes",
    },
  ],
  name: "SignatureWrapper",
  type: "tuple",
};

type BuildUserOperationParams = {
  ownerIndex: bigint;
  authenticatorData: string;
  clientDataJSON: string;
  r: bigint;
  s: bigint;
};

export function buildDummySignature({ ownerIndex, challenge }: { ownerIndex: bigint; challenge: Hex }): Hex {
  const signatureData = encodeAbiParameters(
    [WebAuthnAuthStruct],
    [
      {
        authenticatorData: "0x49960de5880e8c687434170f6476605b8fe4aeb9a28632c7995cf3ba831d97630500000000",
        clientDataJSON: stringToHex(
          `{"type":"webauthn.get","challenge":"${
            base64urlnopad.encode(hexToBytes(challenge))
          }","origin":"https://keys.coinbase.com"}`,
        ),
        challengeIndex: 1n,
        typeIndex: 23n,
        r: 0n,
        s: 0n,
      },
    ],
  );
  return encodeAbiParameters(
    [SignatureWrapperStruct],
    [
      {
        ownerIndex,
        signatureData,
      },
    ],
  );
}

export function buildEOADummySignature({ ownerIndex }: { ownerIndex: bigint }) {
  return buildSignatureWrapperForEOA({
    signature: {
      r: "0x0000000000000000000000000000000000000000000000000000000000000000",
      s: "0x0000000000000000000000000000000000000000000000000000000000000000",
      v: 0n,
    },
    ownerIndex,
  });
}

export function buildSignatureWrapperForEOA(
  { signature, ownerIndex }: { signature: SignReturnType; ownerIndex: bigint },
) {
  const signatureData = encodePacked(
    ["bytes32", "bytes32", "uint8"],
    [
      signature.r,
      signature.s,
      parseInt(signature.v.toString()),
    ],
  );
  return encodeAbiParameters(
    [SignatureWrapperStruct],
    [
      {
        ownerIndex,
        signatureData,
      },
    ],
  );
}

export function buildWebAuthnSignature({
  ownerIndex,
  authenticatorData,
  clientDataJSON,
  r,
  s,
}: BuildUserOperationParams): Hex {
  const challengeIndex = clientDataJSON.indexOf("\"challenge\":");
  const typeIndex = clientDataJSON.indexOf("\"type\":");

  const webAuthnAuthBytes = encodeAbiParameters(
    [WebAuthnAuthStruct],
    [
      {
        authenticatorData,
        clientDataJSON: stringToHex(clientDataJSON),
        challengeIndex,
        typeIndex,
        r,
        s,
      },
    ],
  );

  return encodeAbiParameters(
    [SignatureWrapperStruct],
    [
      {
        ownerIndex,
        signatureData: webAuthnAuthBytes,
      },
    ],
  );
}

export function p256WebAuthnSign(
  { challenge, authenticatorData, p256PrivateKey }: { challenge: Hex; authenticatorData: Hex; p256PrivateKey: any },
) {
  const challengeBase64 = base64urlnopad.encode(hexToBytes(challenge));
  const clientDataJSON =
    `{"type":"webauthn.get","challenge":"${challengeBase64}","origin":"https://keys.coinbase.com"}`;
  const clientDataJSONHash = sha256(stringToBytes(clientDataJSON));
  const message = encodePacked(["bytes", "bytes32"], [authenticatorData, clientDataJSONHash]);
  const sig = p256PrivateKey.sign(Buffer.from(message.slice(2), "hex"), "hex");
  let [r, s] = decodeAbiParameters([{ type: "uint256" }, { type: "uint256" }], `0x${sig}` as Hex);
  const n = hexToBigInt("0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551");
  if (s > n / 2n) {
    s = n - s;
  }
  return { r, s, clientDataJSON };
}
