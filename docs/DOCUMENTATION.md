# Schnitzelhunt ZkApp

*Schnitzeljagd is German for Treasure Hunt/Scavanger Hunt). I guess we just love Schnitzel.*

## Project Overview

### Problem statement 

Suppose you want to play a treasure hunt game that you found online, but you have several concerns: 1) it asks you to share your location and you get a suspicious: surely, they just want to know where I am so they can expose me targeted advertising or even worse a scam. Concern number 2) how can you be 100% sure that noone else playing the game is cheating and the solutions aren't tampered with? After doing some research you find out the game is triggered by a [smart contract](https://en.wikipedia.org/wiki/Smart_contract)- so that means the application is at least decentralised and your win will be eternal and immutable, because it interacts with a blockchain. Because you know a thing or two about blockchains, you know most of them are transparent and you're starting to wonder about concern number 3) how can you make sure your solutions aren't exposed to the public eye? 

### The zk in the schnitzelhunt

The zk stands for *zero knowledge* and it's what enables you to (cryptographically) prove that you've successfully completed the game whilst keeping the solutions as well as your shared location private.

How zk schnitzelhunt works: To complete the game, a user will have to solve 3 riddles. To solve each riddle, a user shares their location via their browser in use. If the location is correct, the user will be presented the next riddle until they've solved all riddles. The evaluation whether the location you share is correct, happens **off-chain**, i.e. the location you share never leaves your browser. If the location you shared is within the valid range, a zero knowledge proof will be generated. Only solving all riddles, will complete the game.

## Technical Implementation

This application is a zkApp developed on MINA compromising
- a smart contract which includes assertions to ensure the submitted location is within the valid range of locations to solve the given riddle, as well as a check to ensure the game is only completed when all riddles have been solved. The smart contract is written in SnarkyJS. 
- a *cute* UI for the user to interact with the game developed with next.js/react

### Flow diagramme 
This flow diagramme should outline the flow of the game:
![Flowchart Treasurehunt Game](flowchart.png)

### Implementation
This section assumes some previous knowledge around zk programming concepts, while providing some links for further reading.

#### Design Decision Parameters
1. at the time of development a zkapp account provides 8 fields of 32 bytes
2. all functions used inside a smart contract must operate on SnarkyJS compatible data types
3. ability to solve a riddle within a valid range (bounding box) 

#### Generating solutions for each riddle
Since we cannot expect the user to hit the exact geographical point (longitude/latitude) of the object in question, we need to allow a wider range of location points (i.e. a bounding box). Each riddle therefore has a dedicated bounding box. Due to the nature of zkapps, we are now bound by two parameters mentioned above. 

To comply with #1, we only store the root of a [merkle tree](https://docs.minaprotocol.com/zkapps/advanced-snarkyjs/merkle-tree) on-chain. The merkle tree will hold the hashes of all possible location points we allow within the bounding box, by storing the root of the merkle tree we can store these off-chain and still use the root to verify that the off-chain data wasn't tampered with.

As for design decision parameter #2, we need to transform our location data, since longitude/latitude points are usually described as floating point numbers which are not part of [SnarkyJS compatible data types](https://docs.minaprotocol.com/zkapps/how-to-write-a-zkapp#primitive-data-types). This is because every `@method` defines a zk-SNARK circuit under the Hood, therefore we are only limited to certain types by design.
Gladly, there's actually another nice way to define a location, namely, *geohashes*. I won't go into too much detail, but on a high level geohash is a geocoding system that represent an area of a geographical point. The way it works is that we recursively divide the world into two e.g first vertically and then give each half a binary value of either 0 or 1 depending on whether the location in question falls into the half or not. The geohash will then represent an address of the area we want to point to, the more we want to zoom in, the longer our geohash becomes. In reality, our geohash is restricted to the number of bits we have available on our system (e.g. with javascript that would be `52-bit`), we therefore need to ensure that we use the same precision at all times to stay consistent.

Further references on geohashes:
- [Quick intro on geohahes](https://www.youtube.com/watch?v=UaMzra18TD8)
- [Geohashing in general](https://medium.com/@bkawk/geohashing-20b282fc9655)
- [Encoding geohashes as integers](https://yatmanwong.medium.com/geohash-implementation-explained-2ed9627a61ff)
- [Using geohashes for proximity search](https://www.arjunmehta.net/post/2014-04-02-geohash-proximity-pt1)

For convenience, I've been using a well-cited library called [node-geohash](https://github.com/sunng87/node-geohash) to generate all valid geohash integers within a bounding box for each riddle. These values are hashed and stored in a merkle tree.

#### Evaluating whether a riddle was solved
The users location is encoded into a geohash integer with the library mentioned above. The geohash is hashed and a [merkle proof](https://computersciencewiki.org/index.php/Merkle_proof) is generated and passed onto the smart contract. The smart contract will first [evaluate all preconditions](https://docs.minaprotocol.com/zkapps/how-to-write-a-zkapp#reading-state), to verify our state variables are as expecting on proofing time. We use a `step` counter to pick the correct merkle root for the riddle that is currently being solved. The merkle proof passed in by the user is evaluated by calculating the root and comparing it to the root of our solution tree. Only if this is correct, the step counter is increased and the riddle is solved.

### Known limitations & potential Improvements

#### Finding the correct bounding box for each riddle
As of now, manual tests were not conducted yet, therefore there could still be false positives when sovling the riddles. Manual tests will be conducted soon.

#### Generating a proof after every riddle
The game currently generates a proof after solving each riddle as well as when completing the game. This could be solved by making use of the [recursion API](https://docs.minaprotocol.com/zkapps/advanced-snarkyjs/recursion), which would enable us to recursively check the proof at each step and only submit the final proof on-chain at the end of the game.

#### Performance
Performance could surely be improved (see list above). I've kept track of the time for all steps involved in the programme running locally:
- build solution merkle trees            24.666 sec 
- compile smart contract                 25.003 sec
- deploy (locally)                        0.014 sec
- proofing first riddle                 162.639 sec
- proofing second riddle                178.221 sec
- proofing third riddle                 226.431 sec
- proofing completion of game           107.141 sec

Since proofing time takes a while, for testing I've included a flag to toggle proof step on/off in the test script, as well as in the UI.

## Ideas to extend this project beyond the current scope
- [ ] Make use of recursion API to generate proof at the end of the game
- [ ] add e2e test to ensure stability of the UI <> contract
- [ ] configure pipeline on github
- [ ] Conduct manual tests to test the selected ranges (laptop)
- [ ] User setup/login
- [ ] Conduct manual test with deployed app (phone/tablet)
- [ ] Leaderboard: present proofs of winners 
- [ ] Include a timer 