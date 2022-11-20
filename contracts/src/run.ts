import {
  LocationCheck,
  deployApp,
  Solution1Tree,
  Solution2Tree,
  Solution3Tree,
  generate_solution_tree,
  SchnitzelInterface,
} from './Schnitzel.js';
import { Field, Poseidon, shutdown } from 'snarkyjs';
import geohash from 'ngeohash';
import { tic, toc } from './tictoc.js';

/*
  when turned off it only adds one geohash solution to the solutionTree (used for quick testing/showcasing) 
  rather than loading the whole solution tree to allow for a wider range of allowed locations per solution
*/
const doQuick = false;
/*
   when turned off it will skip generating a proof for correct solutions, 
  may be used for quick testing of the logic
*/
const doProof = false;

let Solution1Map = new Map<string, number>(); // mapping geohash to index
let Solution2Map = new Map<string, number>(); // mapping geohash to index
let Solution3Map = new Map<string, number>(); // mapping geohash to index

if (doQuick) {
  // solution 1
  const geohash_solution1 = geohash.encode_int(48.2107958217, 16.3736155926);
  console.log('geohash_solution1 ' + geohash_solution1);
  let hash = Poseidon.hash(Field(+geohash_solution1).toFields());
  console.log('geohash_solution1 hash ' + hash);
  Solution1Map.set(geohash_solution1.toString(), 0);
  Solution1Tree.setLeaf(BigInt(0), hash);

  // solution 2
  const geohash_solution2 = geohash.encode_int(48.2079410492, 16.3716678382);
  console.log('geohash_solution2 ' + geohash_solution2);
  let hash2 = Poseidon.hash(Field(+geohash_solution2).toFields());
  console.log('geohash_solution2 hash ' + hash2);
  Solution2Map.set(geohash_solution2.toString(), 0);
  Solution2Tree.setLeaf(BigInt(0), hash2);

  // TODO: solution 3
  const geohash_solution3 = geohash.encode_int(48.2086269882, 16.3725081062);
  console.log('geohash_solution3 ' + geohash_solution3);
  let hash3 = Poseidon.hash(Field(+geohash_solution3).toFields());
  console.log('geohash_solution3 hash ' + hash3);
  Solution3Map.set(geohash_solution3.toString(), 0);
  Solution3Tree.setLeaf(BigInt(0), hash3);
} else {
  tic('read solutions into memory');
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

// deploy checkIn zkapp
let zkapp: SchnitzelInterface = await deployApp(
  Solution1Tree.getRoot(),
  Solution2Tree.getRoot(),
  Solution3Tree.getRoot(),
  doProof
);

console.log('solution1Map size ' + Solution1Map.size);
console.log('solution2Map size ' + Solution2Map.size);
console.log('Solution3Map size ' + Solution3Map.size);

let solved = zkapp.getState().solved;
let step = zkapp.getState().step;

console.log('Initial State finished: ', solved);
console.log('Initial State step: ', step);

// attempt to update state with wrong location, should fail
console.log(
  `\n ==================================================== \n  Attempting to update state from ${solved} with incorrect location ...`
);

await zkapp.hunt(
  new LocationCheck(48, 16),
  Solution1Map,
  Solution2Map,
  Solution3Map,
  +step,
  doProof
);

solved = zkapp.getState().solved;
step = zkapp.getState().step;

// assert state is not updated after incorrect move

console.log('State finished: ', solved);
console.log('State step: ', step);

if (solved == true) {
  throw Error('We could update the state solved with wrong location');
}

if (step == '1') {
  throw Error('We could update the state step with wrong location');
}

console.log(
  'Correctly rejected attempt to update state with incorrect location ! solved: ' +
    solved
);

console.log(
  `\n ==================================================== \n Solving 1st out of 2 riddles, should update state accordingly...`
);

await zkapp.hunt(
  new LocationCheck(48.2107958217, 16.3736155926),
  Solution1Map,
  Solution2Map,
  Solution3Map,
  +step,
  doProof
);

solved = zkapp.getState().solved;
step = zkapp.getState().step;

console.log('State finished: ', solved);
console.log('State step: ', step);

if (solved == true) {
  throw Error('Should not set game to finished after solving 1/3 riddles');
}

if (step != '1') {
  throw Error('Did not increase step after successfully solving 1st riddle');
}

// TODO: add error case here too before submitting correct 2nd step

console.log(
  `\n ==================================================== \n Solving 2nd out of 3 riddles with correct location...`
);

await zkapp.hunt(
  new LocationCheck(48.2079410492, 16.3716678382),
  Solution1Map,
  Solution2Map,
  Solution3Map,
  +step,
  doProof
);

solved = zkapp.getState().solved;
step = zkapp.getState().step;

// assert state is correctly updated after correct move

console.log('State finished: ', solved);
console.log('State step: ', step);

if (solved == true) {
  throw Error('Should not set game to finished after solving 1/3 riddles');
}

if (step != '2') {
  throw Error('Did not increase step after successfully solving 2nd riddle');
}

console.log(
  `\n ==================================================== \n Solving 3rd out of 3 riddles, should now update state to true with correct location...`
);

await zkapp.hunt(
  new LocationCheck(48.2086269882, 16.3725081062),
  Solution1Map,
  Solution2Map,
  Solution3Map,
  +step,
  doProof
);

solved = zkapp.getState().solved;
step = zkapp.getState().step;

// assert state is correctly updated after correct move

console.log('State finished: ', solved);
console.log('State step: ', step);

if (step != '3') {
  throw Error('Did not increase step after successfully solving 2nd riddle');
}

await zkapp.finish(doProof);

solved = zkapp.getState().solved;

if (solved == false) {
  throw Error(
    `Did not set game to finish ${solved} after calling finish method`
  );
}

console.log(`Current state succesfully updated to ${solved}`);
console.log(`Step successfully updated to ${step}`);

shutdown();
