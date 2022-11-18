import { LocationCheck, deployApp, Tree } from './CheckIn.js';
import { Bool, Field, Poseidon, shutdown } from 'snarkyjs';
import geohash from 'ngeohash';
import { read_solution_into_map_from_memory } from './utils.js';
import { tic, toc } from './tictoc.js';

const doQuick = true;
const doProof = true;

let solution1Map = new Map<string, number>(); // mapping geohash to index

if (doQuick) {
  const test_geohash = geohash.encode_int(48.2107958217, 16.3736155926);
  console.log('test_geohash ' + test_geohash);
  let hash = Poseidon.hash(Field.fromNumber(+test_geohash).toFields());
  console.log('hash ' + hash);
  solution1Map.set(test_geohash.toString(), 0);
  Tree.setLeaf(BigInt(0), hash);
} else {
  tic('read solutions into memory');
  solution1Map = read_solution_into_map_from_memory(
    48.2107356534,
    16.3736139593,
    48.2108048225,
    16.3737322524
  );
  toc();
}

console.log('root ' + Tree.getRoot());

// deploy checkIn zkapp
let zkapp = await deployApp(Tree.getRoot(), doProof);

console.log('solution1Map size ' + solution1Map.size);
let solved = zkapp.getState().solved;
let counter = zkapp.getState().counter;

console.log('Initial State checkInState', solved);
console.log('Initial State counter', counter);

// attempt to update state with wrong location, should fail
console.log(
  `Attempting to update state from ${solved} with incorrect location ...`
);

await zkapp.checkIn(new LocationCheck(48, 16), solution1Map);

if (solved == true) {
  throw Error('We could update the state with wrong location');
}

console.log(
  'Correctly rejected attempt to update state with incorrect location ! checkInState: ' +
    solved
);

console.log(`Updating state from ${solved} to true with correct location...`);

await zkapp.checkIn(
  new LocationCheck(48.2107958217, 16.3736155926),
  solution1Map
);

solved = zkapp.getState().solved;
counter = zkapp.getState().counter;

console.log('currentState: ' + solved);
console.log('counter: ' + counter);

if (solved !== true) {
  throw Error(
    `Current state of ${solved} does not match true after checking in with correct location`
  );
}

console.log(`Updating state from ${solved} to false with update...`);

await zkapp.update(Bool(false));

solved = zkapp.getState().solved;
counter = zkapp.getState().counter;

console.log('solved: ' + solved);
console.log('counter: ' + counter);

if (counter != '2') {
  throw Error(`Current state of ${counter} does not match 2 after update`);
}
if (solved == true) {
  throw Error(`Current state of ${solved} does not match false after update`);
}

console.log(`Current state succesfully updated to ${solved}`);

shutdown();
