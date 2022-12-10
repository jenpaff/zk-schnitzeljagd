import {
  LocationCheck,
  Solution1Tree,
  Solution2Tree,
  Solution3Tree,
  generate_solution_tree,
} from './Schnitzel.js';
import {
  AccountUpdate,
  Field,
  Mina,
  Poseidon,
  PrivateKey,
  shutdown,
} from 'snarkyjs';
import geohash from 'ngeohash';
import { tic, toc } from './tictoc.js';
import {
  RecSchnitzelApp,
  RecSchnitzelHelper,
  RecSchnitzelRollup,
} from './RecSchnitzel.js';
/*
    when turned off it only adds one geohash solution to the solutionTree (used for quick testing/showcasing) 
    rather than loading the whole solution tree to allow for a wider range of allowed locations per solution
  */
const doQuick = true;

let Solution1Map = new Map<string, number>(); // mapping geohash to index
let Solution2Map = new Map<string, number>(); // mapping geohash to index
let Solution3Map = new Map<string, number>(); // mapping geohash to index

if (doQuick) {
  // solution 1
  const geohash_solution1 = geohash.encode_int(48.2107958217, 16.3736155926);
  let hash = Poseidon.hash(Field(+geohash_solution1).toFields());
  Solution1Map.set(geohash_solution1.toString(), 0);
  Solution1Tree.setLeaf(BigInt(0), hash);

  // solution 2
  const geohash_solution2 = geohash.encode_int(48.2079410492, 16.3716678382);
  let hash2 = Poseidon.hash(Field(+geohash_solution2).toFields());
  Solution2Map.set(geohash_solution2.toString(), 0);
  Solution2Tree.setLeaf(BigInt(0), hash2);

  // solution 3
  const geohash_solution3 = geohash.encode_int(48.2086269882, 16.3725081062);
  let hash3 = Poseidon.hash(Field(+geohash_solution3).toFields());
  Solution3Map.set(geohash_solution3.toString(), 0);
  Solution3Tree.setLeaf(BigInt(0), hash3);
} else {
  tic('build solution merkle trees');
  // write_solution_map_to_file(
  //   'solution1.txt',
  //   48.2107356534,
  //   16.3736139593,
  //   48.2108048225,
  //   16.3737322524
  // );
  Solution1Map = generate_solution_tree(
    48.2107356534,
    16.3736139593,
    48.2108048225,
    16.3737322524,
    Solution1Tree
  );
  // write_solution_map_to_file(
  //   'solution2.txt',
  //   48.2079049216,
  //   16.3716384673,
  //   48.2079451583,
  //   16.3717048444
  // );
  Solution2Map = generate_solution_tree(
    48.2079049216,
    16.3716384673,
    48.2079451583,
    16.3717048444,
    Solution2Tree
  );
  // write_solution_map_to_file(
  //   'solution3.txt',
  //   48.2085512071,
  //   16.3723948785,
  //   48.208693012,
  //   16.372583382
  // );
  Solution3Map = generate_solution_tree(
    48.2086269882,
    16.3725081062,
    48.2086858438,
    16.3725546748,
    Solution3Tree
  );
  toc();
}

console.log('root 1' + Solution1Tree.getRoot());
console.log('root 2' + Solution2Tree.getRoot());
console.log('root 2' + Solution3Tree.getRoot());

console.log('solution1Map size ' + Solution1Map.size);
console.log('solution2Map size ' + Solution2Map.size);
console.log('Solution3Map size ' + Solution3Map.size);

tic('compiling');
await RecSchnitzelApp.compile();
toc();

tic('prove (init)');
let initialState = RecSchnitzelHelper.init(
  Solution1Tree.getRoot(),
  Solution2Tree.getRoot(),
  Solution3Tree.getRoot()
);
let initialProof = await RecSchnitzelApp.init(initialState);
toc();

console.log('Proof state initialized!');

console.log(
  `\n ==================================================== \n Solving 1st out of 2 riddles, should update state accordingly...`
);

// TODO: add error case

tic('prove (riddle 1)');
let location1 = new LocationCheck(
  geohash.encode_int(48.2107958217, 16.37361559266)
);
let location1Witness = RecSchnitzelHelper.generateMerkleProof(
  location1,
  Solution1Map,
  Solution2Map,
  Solution3Map,
  initialProof
);
let location1State = RecSchnitzelHelper.hunt(initialProof);
let location1Proof = await RecSchnitzelApp.hunt(
  location1State,
  location1,
  location1Witness,
  initialProof
);
toc();

console.log('Solved riddle 1');
console.log('json proof: ' + location1Proof.toJSON().proof);

let step = location1State.step.toString();

// assert state
console.log('State step: ', step);

if (step != '1') {
  throw Error('Did not increase step after successfully solving 1st riddle');
}

// TODO: add error case here too before submitting correct 2nd step

console.log(
  `\n ==================================================== \n Solving 2nd out of 3 riddles with correct location...`
);

tic('prove (riddle 2)');
let location2 = new LocationCheck(
  geohash.encode_int(48.2079410492, 16.3716678382)
);
let location2Witness = RecSchnitzelHelper.generateMerkleProof(
  location2,
  Solution1Map,
  Solution2Map,
  Solution3Map,
  location1Proof
);
let location2State = RecSchnitzelHelper.hunt(location1Proof);
let location2Proof = await RecSchnitzelApp.hunt(
  location2State,
  location2,
  location2Witness,
  location1Proof
);
toc();

console.log('Solved riddle 2');
console.log('json proof: ' + location2Proof.toJSON().proof);

// assert state is correctly updated after correct move

console.log('State step: ', step);

step = location2State.step.toString();

if (step != '2') {
  throw Error('Did not increase step after successfully solving 2nd riddle');
}

console.log(
  `\n ==================================================== \n Solving 3rd out of 3 riddles, should now update state to true with correct location...`
);

tic('prove (riddle 3)');
let location3 = new LocationCheck(
  geohash.encode_int(48.2086269882, 16.3725081062)
);
let location3Witness = RecSchnitzelHelper.generateMerkleProof(
  location3,
  Solution1Map,
  Solution2Map,
  Solution3Map,
  location2Proof
);
let location3State = RecSchnitzelHelper.hunt(location2Proof);
let location3Proof = await RecSchnitzelApp.hunt(
  location3State,
  location3,
  location3Witness,
  location2Proof
);
toc();

console.log('Solved riddle 3 - final proof!');
console.log('json proof: ' + location3Proof.toJSON().proof);

// TODO: compile & deploy rollup

let zkAppPrivateKey = PrivateKey.random();
let zkAppAddress = zkAppPrivateKey.toPublicKey();
let zkapp = new RecSchnitzelRollup(zkAppAddress);

let Local = Mina.LocalBlockchain();
Mina.setActiveInstance(Local);
const publisherAccount = Local.testAccounts[0].privateKey;

// deploy
tic('compile & deploy rollup');
await RecSchnitzelRollup.compile();
let tx = await Mina.transaction(publisherAccount, () => {
  AccountUpdate.fundNewAccount(publisherAccount);
  zkapp.deploy({ zkappKey: zkAppPrivateKey });
});
await tx.send().wait();
toc();

// prove that we have a proof that shows that we won
tic('prove (rollup)');
tx = await Mina.transaction(publisherAccount, () => {
  // call out method with final proof from the ZkProgram as argument
  zkapp.finish(location3Proof);
});
await tx.prove();
await tx.send().wait();
toc();

let solved = zkapp.finished.get().toBoolean();

// assert state is correctly updated after correct move
console.log('State finished: ', solved);

if (solved != true) {
  throw Error('Did not complete game after solving all riddles');
}

console.log('Finished recursive schnitzelhunt ! :) ');

shutdown();
