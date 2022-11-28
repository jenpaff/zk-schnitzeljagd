import {
  Solution1Tree,
  Solution2Tree,
  Solution3Tree,
  generate_solution_tree,
} from './RecSchnitzel.js';
import {
  AccountUpdate,
  Bool,
  Field,
  Mina,
  Poseidon,
  PrivateKey,
  Proof,
  shutdown,
  SmartContract,
  state,
  State,
  method,
  UInt32,
  DeployArgs,
  Permissions,
  Circuit,
} from 'snarkyjs';
import geohash from 'ngeohash';
import { tic, toc } from './tictoc.js';
import {
  RecSchnitzelHelper,
  convert_location_to_geohash,
  RecSchnitzelHuntState,
  RecSchnitzelHunt,
} from './RecSchnitzel.js';
/*
    when turned off it only adds one geohash solution to the solutionTree (used for quick testing/showcasing) 
    rather than loading the whole solution tree to allow for a wider range of allowed locations per solution
  */
const doQuick = true;
const proofsEnabled = true;

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
await RecSchnitzelHunt.compile();
toc();

tic('prove (init)');
let initialState = RecSchnitzelHelper.init(
  Solution1Tree.getRoot(),
  Solution2Tree.getRoot(),
  Solution3Tree.getRoot()
);
let initialProof = await RecSchnitzelHunt.init(initialState);
toc();

console.log('Proof state initialized!');

console.log(
  `\n ==================================================== \n Solving 1st out of 2 riddles, should update state accordingly...`
);

tic('prove (riddle 1)');
let location1 = {
  sharedGeoHash: convert_location_to_geohash(48.2107958217, 16.37361559266),
};
let location1Witness = RecSchnitzelHelper.generateMerkleProof(
  location1,
  Solution1Map,
  Solution2Map,
  Solution3Map,
  initialProof
);
let location1State = RecSchnitzelHelper.hunt(initialProof);
let location1Proof = await RecSchnitzelHunt.hunt(
  location1State,
  location1,
  location1Witness,
  initialProof
);
toc();

console.log('Solved riddle 1');
console.log('json proof: ' + location1Proof.toJSON().proof);

let step = location1Proof.publicInput.step.toString();

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
let location2 = {
  sharedGeoHash: convert_location_to_geohash(48.2079410492, 16.3716678382),
};
let location2Witness = RecSchnitzelHelper.generateMerkleProof(
  location2,
  Solution1Map,
  Solution2Map,
  Solution3Map,
  location1Proof
);
let location2State = RecSchnitzelHelper.hunt(location1Proof);
let location2Proof = await RecSchnitzelHunt.hunt(
  location2State,
  location2,
  location2Witness,
  location1Proof
);
toc();

console.log('Solved riddle 2');
console.log('json proof: ' + location2Proof.toJSON().proof);

// assert state is correctly updated after correct move

step = location2Proof.publicInput.step.toString();
console.log('State step: ', step);

if (step != '2') {
  throw Error('Did not increase step after successfully solving 2nd riddle');
}

console.log(
  `\n ==================================================== \n Solving 3rd out of 3 riddles, should now update state to true with correct location...`
);

tic('prove (riddle 3)');
let location3 = {
  sharedGeoHash: convert_location_to_geohash(48.2086269882, 16.3725081062),
};
let location3Witness = RecSchnitzelHelper.generateMerkleProof(
  location3,
  Solution1Map,
  Solution2Map,
  Solution3Map,
  location2Proof
);
let location3State = RecSchnitzelHelper.hunt(location2Proof);
let location3Proof = await RecSchnitzelHunt.hunt(
  location3State,
  location3,
  location3Witness,
  location2Proof
);
toc();

console.log('Solved riddle 3 - final proof!');
console.log('json proof: ' + location3Proof.toJSON().proof);

step = location3Proof.publicInput.step.toString();
console.log('State step: ', step);

if (step != '3') {
  throw Error('Did not increase step after successfully solving 3nd riddle');
}

class RecSchnitzelProof extends Proof<RecSchnitzelHuntState> {
  static publicInputType = RecSchnitzelHuntState;
  static tag = () => RecSchnitzelHunt;
}

class RecSchnitzelRollup extends SmartContract {
  @state(Bool) finished = State<Bool>();

  deploy(args: DeployArgs) {
    super.deploy(args);
    this.setPermissions({
      ...Permissions.default(),
      editState: Permissions.proofOrSignature(),
    });
  }

  @method finish(
    proof: RecSchnitzelProof // <-- we're passing in a proof!
  ) {
    // verify the proof
    proof.verify();

    Circuit.log(proof.publicInput);

    // assert that user completed all steps
    proof.publicInput.step.assertEquals(UInt32.from(3));

    // declare that someone won this game!
    this.finished.set(Bool(true));
  }
}

let zkappKey = PrivateKey.random();
let zkAppAddress = zkappKey.toPublicKey();
let zkapp = new RecSchnitzelRollup(zkAppAddress);

let Local = Mina.LocalBlockchain({ proofsEnabled: proofsEnabled });
Mina.setActiveInstance(Local);
const feePayer = Local.testAccounts[0].privateKey;

// deploy

console.log('Deploying Checkin App ....');
let verificationKey: any;

if (proofsEnabled) {
  tic('compile');
  ({ verificationKey } = await RecSchnitzelRollup.compile());
  toc();
}

try {
  let tx = await Mina.transaction(feePayer, () => {
    console.log('Funding account');
    AccountUpdate.fundNewAccount(feePayer);
    console.log('Deploying smart contract...');
    tic('deploy');
    zkapp.deploy({ verificationKey, zkappKey });
    toc();
  });
  await tx.send();

  console.log('Deployment successful!');
} catch (error) {
  console.error('Error deploying app ' + error);
}

try {
  let txn = await Mina.transaction(feePayer, () => {
    console.log('Initialising smart contract...');
    zkapp.init();
  });
  tic('prove');
  await txn.prove().then((tx) => {
    tx.forEach((p) => console.log(' \n json proof: ' + p?.toJSON().proof));
  });
  toc();
  await txn.send();

  console.log('Contract successfully deployed and initialized!');
} catch (error) {
  console.error('Error initialising app ' + error);
}

// prove that we have a proof that shows that we won
console.log('Initiating finish process...');
try {
  let tx = await Mina.transaction(feePayer, () => {
    zkapp.finish(location3Proof);
  });
  await tx.prove().then((tx) => {
    tx.forEach((p) => console.log(' \n json proof: ' + p?.toJSON().proof));
  });
  await tx.send();
  console.log('Finish process successful!');
} catch (error) {
  console.error('Fininsh process rejected: ' + error);
}

let solved = zkapp.finished.get().toBoolean();

// assert state is correctly updated after correct move
console.log('State finished: ', solved);

if (solved != true) {
  throw Error('Did not complete game after solving all riddles');
}

console.log('Finished recursive schnitzelhunt ! :) ');

shutdown();
