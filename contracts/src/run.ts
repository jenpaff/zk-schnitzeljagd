import {
  LocationCheck,
  deployApp,
  Solution1Tree,
  Solution2Tree,
} from './Schnitzel.js';
import { Field, Poseidon, shutdown } from 'snarkyjs';
import geohash from 'ngeohash';
import { read_solution_into_map_from_memory } from './utils.js';
import { tic, toc } from './tictoc.js';

const doQuick = true;
const doProof = false;

let Solution1Map = new Map<string, number>(); // mapping geohash to index
let Solution2Map = new Map<string, number>(); // mapping geohash to index

if (doQuick) {
  // solution 1
  const geohash_solution1 = geohash.encode_int(48.2107958217, 16.3736155926);
  console.log('geohash_solution1 ' + geohash_solution1);
  let hash = Poseidon.hash(Field(+geohash_solution1).toFields());
  console.log('geohash_solution1 hash ' + hash);
  Solution1Map.set(geohash_solution1.toString(), 0);
  Solution1Tree.setLeaf(BigInt(0), hash);

  // solution 2
  const geohash_solution2 = geohash.encode_int(48.2107958217, 16.3736155926);
  console.log('geohash_solution2 ' + geohash_solution2);
  let hash2 = Poseidon.hash(Field(+geohash_solution2).toFields());
  console.log('geohash_solution2 hash ' + hash2);
  Solution2Map.set(geohash_solution2.toString(), 0);
  Solution2Tree.setLeaf(BigInt(0), hash2);

  // TODO: solution 3
} else {
  tic('read solutions into memory');
  Solution1Map = read_solution_into_map_from_memory(
    48.2107356534,
    16.3736139593,
    48.2108048225,
    16.3737322524
  );
  toc();
}

console.log('root 1' + Solution1Tree.getRoot());
console.log('root 2' + Solution2Tree.getRoot());

// deploy checkIn zkapp
let zkapp = await deployApp(
  Solution1Tree.getRoot(),
  Solution2Tree.getRoot(),
  doProof
);

console.log('solution1Map size ' + Solution1Map.size);
console.log('solution2Map size ' + Solution2Map.size);

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
  +step,
  doProof
);

solved = zkapp.getState().solved;
step = zkapp.getState().step;

console.log('State finished: ', solved);
console.log('State step: ', step);

if (solved == true) {
  throw Error('Should not set game to finished after solving 1/2 riddles');
}

if (step != '1') {
  throw Error('Did not increase step after successfully solving 1st riddle');
}

// TODO: add error case here too before submitting correct 2nd step

console.log(
  `\n ==================================================== \n Solving 2nd out of 2 riddles, should now update state to true with correct location...`
);

await zkapp.hunt(
  new LocationCheck(48.2107958217, 16.3736155926),
  Solution1Map,
  Solution2Map,
  +step,
  doProof
);

solved = zkapp.getState().solved;
step = zkapp.getState().step;

// assert state is correctly updated after correct move

console.log('State finished: ', solved);
console.log('State step: ', step);

if (step != '2') {
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
