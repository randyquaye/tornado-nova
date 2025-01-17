include "../node_modules/circomlib/circuits/poseidon.circom";
include "./merkleProof.circom"
include "./keypair.circom"

/*
Utxo structure:
{
    amount,
    pubkey,
    blinding, // random number
}

commitment = hash(amount, pubKey, blinding)
nullifier = hash(commitment, merklePath, sign(privKey, commitment, merklePath))
*/

// Universal JoinSplit transaction with nIns inputs and 2 outputs
template Transaction(levels, nIns, nOuts, zeroLeaf) {
    signal input root;
    // extAmount = external amount used for deposits and withdrawals
    // correct extAmount range is enforced on the smart contract
    // publicAmount = extAmount - fee
    signal input publicAmount;
    signal input extDataHash;
    // signal input tokenType;

    // data for transaction inputs
    signal         input inputNullifier[nIns];
    signal private input inAmount[nIns];
    signal private input inPrivateKey[nIns];
    signal private input inBlinding[nIns];
    signal private input inType[nIns];
    signal private input inRand[nIns];
    signal private input inPathIndices[nIns];
    signal private input inPathElements[nIns][levels];

    // data for transaction outputs
    signal         input outputCommitment[nOuts];
    signal private input outAmount[nOuts];
    signal private input outPubkey[nOuts];
    signal private input outBlinding[nOuts];
    signal private input outType[nIns];
    signal private input outRand[nIns];

    component inKeypair[nIns];
    component inSignature[nIns];
    component inCommitmentHasher[nIns];
    component inCommitmentHasherB[nIns];
    component inNullifierHasher[nIns];
    component inTree[nIns];
    component inCheckRoot[nIns];
    var sumIns = 0;

    // verify correctness of transaction inputs
    for (var tx = 0; tx < nIns; tx++) {
        inKeypair[tx] = Keypair();
        inKeypair[tx].privateKey <== inPrivateKey[tx];

        inCommitmentHasherB[tx] = Poseidon(2);
        inCommitmentHasherB[tx].inputs[0] <== inKeypair[tx].publicKey;
        inCommitmentHasherB[tx].inputs[1] <== inBlinding[tx];

        inCommitmentHasher[tx] = Poseidon(4);
        inCommitmentHasher[tx].inputs[0] <== inCommitmentHasherB[tx].out;
        inCommitmentHasher[tx].inputs[1] <== inAmount[tx];
        inCommitmentHasher[tx].inputs[2] <== inType[tx];
        inCommitmentHasher[tx].inputs[3] <== inRand[tx];

        inSignature[tx] = Signature();
        inSignature[tx].privateKey <== inPrivateKey[tx];
        inSignature[tx].commitment <== inCommitmentHasher[tx].out;
        inSignature[tx].merklePath <== inPathIndices[tx];

        inNullifierHasher[tx] = Poseidon(3);
        inNullifierHasher[tx].inputs[0] <== inCommitmentHasher[tx].out;
        inNullifierHasher[tx].inputs[1] <== inPathIndices[tx];
        inNullifierHasher[tx].inputs[2] <== inSignature[tx].out;
        inNullifierHasher[tx].out === inputNullifier[tx];

        inTree[tx] = MerkleProof(levels);
        inTree[tx].leaf <== inCommitmentHasher[tx].out;
        inTree[tx].pathIndices <== inPathIndices[tx];
        for (var i = 0; i < levels; i++) {
            inTree[tx].pathElements[i] <== inPathElements[tx][i];
        }

        // check merkle proof only if amount is non-zero
        inCheckRoot[tx] = ForceEqualIfEnabled();
        inCheckRoot[tx].in[0] <== root;
        inCheckRoot[tx].in[1] <== inTree[tx].root;
        inCheckRoot[tx].enabled <== inAmount[tx];

        // We don't need to range check input amounts, since all inputs are valid UTXOs that
        // were already checked as outputs in the previous transaction (or zero amount UTXOs that don't
        // need to be checked either).
        sumIns += inAmount[tx];
    }

    component outCommitmentHasherB[nOuts];
    component outCommitmentHasher[nOuts];
    component outAmountCheck[nOuts];
    var sumOuts = 0;

    // verify correctness of transaction outputs
    for (var tx = 0; tx < nOuts; tx++) {

        outCommitmentHasherB[tx] = Poseidon(2);
        outCommitmentHasherB[tx].inputs[0] <== outPubkey[tx];
        outCommitmentHasherB[tx].inputs[1] <== outBlinding[tx];

        outCommitmentHasher[tx] = Poseidon(4);
        outCommitmentHasher[tx].inputs[0] <== outCommitmentHasherB[tx].out;
        outCommitmentHasher[tx].inputs[1] <== outAmount[tx];
        outCommitmentHasher[tx].inputs[2] <== outType[tx];
        outCommitmentHasher[tx].inputs[3] <== outRand[tx];
        outCommitmentHasher[tx].out === outputCommitment[tx];

        // Check that amount fits into 248 bits to prevent overflow
        outAmountCheck[tx] = Num2Bits(248);
        outAmountCheck[tx].in <== outAmount[tx];

        sumOuts += outAmount[tx];
    }

    // check that there are no same nullifiers among all inputs
    component sameNullifiers[nIns * (nIns - 1) / 2];
    var index = 0;
    for (var i = 0; i < nIns - 1; i++) {
      for (var j = i + 1; j < nIns; j++) {
          sameNullifiers[index] = IsEqual();
          sameNullifiers[index].in[0] <== inputNullifier[i];
          sameNullifiers[index].in[1] <== inputNullifier[j];
          sameNullifiers[index].out === 0;
          index++;
      }
    }

    component inTypes[nIns * (nIns - 1) / 2];
    var Iindex = 0;
    for (var i = 0; i < nIns - 1; i++) {
      for (var j = i + 1; j < nIns; j++) {
          inTypes[Iindex] = IsEqual();
          inTypes[Iindex].in[0] <== inType[i];
          inTypes[Iindex].in[1] <== inType[j];
          inTypes[Iindex].out === 1;
          Iindex++;
      }
    }

    component outTypes[nOuts * (nOuts - 1) / 2];
    var IindexI = 0;
    for (var i = 0; i < nOuts - 1; i++) {
      for (var j = i + 1; j < nOuts; j++) {
          outTypes[IindexI] = IsEqual();
          outTypes[IindexI].in[0] <== outType[i];
          outTypes[IindexI].in[1] <== outType[j];
          outTypes[IindexI].out === 1;
          IindexI++;
      }
    }

    component sameType;
    sameType = IsEqual();
    sameType.in[0] <== outType[0];
    sameType.in[1] <== inType[0];
    sameType.out === 1;


    // verify amount invariant
    sumIns + publicAmount === sumOuts;

    // optional safety constraint to make sure extDataHash cannot be changed
    signal extDataSquare <== extDataHash * extDataHash;
}
