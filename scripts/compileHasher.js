// Generates Hasher artifact at compile-time using external compilermechanism
const path = require('path')
const fs = require('fs')
const genContract = require('circomlib/src/poseidon_gencontract.js')
const outputPath = path.join(__dirname, '..','client','src', 'artifacts', 'contracts')
const outputFile = path.join(outputPath, 'Hasher.json')
const outputFile2 = path.join(outputPath, 'Hasher4.json')


if (!fs.existsSync(outputPath)) {
  fs.mkdirSync(outputPath, { recursive: true })
}

const contract = {
  _format: 'hh-sol-artifact-1',
  sourceName: 'contracts/Hasher.sol',
  linkReferences: {},
  deployedLinkReferences: {},
  contractName: 'Hasher',
  abi: genContract.generateABI(2),
  bytecode: genContract.createCode(2),
}

const contract2 = {
  _format: 'hh-sol-artifact-1',
  sourceName: 'contracts/HasherT4.sol',
  linkReferences: {},
  deployedLinkReferences: {},
  contractName: 'Hasher4',
  abi: genContract.generateABI(4),
  bytecode: genContract.createCode(4),
}


fs.writeFileSync(outputFile, JSON.stringify(contract, null, 2))
fs.writeFileSync(outputFile2, JSON.stringify(contract2, null, 2))
