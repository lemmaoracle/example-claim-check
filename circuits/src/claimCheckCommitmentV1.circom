pragma circom 2.1.0;
include "circomlib/circuits/poseidon.circom";

template ClaimCheckCommitment() {
    signal input modelDigest;
    signal input attestationToken;
    signal input claimHash;
    signal input outputHash;
    signal input nonce;

    signal input claimedRoot;
    signal input timestampMin;
    signal input timestampMax;

    signal output root;

    component hasher = Poseidon(5);
    hasher.inputs[0] <== modelDigest;
    hasher.inputs[1] <== attestationToken;
    hasher.inputs[2] <== claimHash;
    hasher.inputs[3] <== outputHash;
    hasher.inputs[4] <== nonce;

    root <== hasher.out;
    root === claimedRoot;
}

component main {public [claimedRoot, timestampMin, timestampMax]} = ClaimCheckCommitment();