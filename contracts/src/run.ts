import { LocationCheck, deployApp } from './CheckIn.js';
import { shutdown } from 'snarkyjs';

// deploy checkIn zkapp
let zkapp = await deployApp();

const targetLocation = zkapp.getState().targetGeoHash;
const checkInState = zkapp.getState().checkedIn;

let currentState;

console.log('Initial State targetLocation', targetLocation);
console.log('Initial State checkInState', checkInState);

// attempt to update state with wrong location, should fail
console.log(
  `Attempting to update state from ${checkInState} with incorrect location ...`
);

await zkapp.checkIn(new LocationCheck(47, 15));

if (checkInState == true) {
  throw Error('We could update the state with wrong location');
}

console.log(
  'Correctly rejected attempt to update state with incorrect location ! checkInState: ' +
    checkInState
);

console.log(
  `Updating state from ${checkInState} to true with correct location...`
);

await zkapp.checkIn(new LocationCheck(48.208487, 16.372571));

currentState = zkapp.getState().checkedIn;

if (currentState !== true) {
  throw Error(
    `Current state of ${currentState} does not match true after checking in with correct location`
  );
}

console.log(`Current state succesfully updated to ${currentState}`);

shutdown();
