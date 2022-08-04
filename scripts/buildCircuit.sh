#!/bin/bash -e
POWERS_OF_TAU=15 # circuit will support max 2^POWERS_OF_TAU constraints
mkdir -p client/src/artifacts/circuits
if [ ! -f client/src/artifacts/circuits/ptau$POWERS_OF_TAU ]; then
  echo "Downloading powers of tau file"
  curl -L https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_$POWERS_OF_TAU.ptau --create-dirs -o client/src/artifacts/circuits/ptau$POWERS_OF_TAU
fi
npx circom -v -r client/src/artifacts/circuits/transaction$1.r1cs -w client/src/artifacts/circuits/transaction$1.wasm -s client/src/artifacts/circuits/transaction$1.sym circuits/transaction$1.circom
npx snarkjs groth16 setup client/src/artifacts/circuits/transaction$1.r1cs client/src/artifacts/circuits/ptau$POWERS_OF_TAU client/src/artifacts/circuits/tmp_transaction$1.zkey
echo "qwe" | npx snarkjs zkey contribute client/src/artifacts/circuits/tmp_transaction$1.zkey client/src/artifacts/circuits/transaction$1.zkey
npx snarkjs zkey export solidityverifier client/src/artifacts/circuits/transaction$1.zkey client/src/artifacts/circuits/Verifier$1.sol
sed -i.bak "s/contract Verifier/contract Verifier${1}/g" client/src/artifacts/circuits/Verifier$1.sol
#zkutil setup -c artifacts/circuits/transaction$1.r1cs -p artifacts/circuits/transaction$1.params
#zkutil generate-verifier -p artifacts/circuits/transaction$1.params -v artifacts/circuits/Verifier.sol
npx snarkjs info -r client/src/artifacts/circuits/transaction$1.r1cs
