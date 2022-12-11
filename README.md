# zk Schnitzelhunt

*Some call it treasure hunt, some call it scavenger hunt, in my home country Austria we call it Schnitzeljagd (I half-translated it for your convenience).*

## Treasure Hunt / Scavenger Hunt

> A scavenger hunt is a game in which the organizers prepare a list defining specific items, which the participants seek to gather or complete all items on the list, usually without purchasing them.[1] Usually participants work in small teams, although the rules may allow individuals to participate. The goal is to be the first to complete the list or to complete the most items on that list. In variations of the game, players take photographs of listed items or be challenged to complete the tasks on the list in the most creative manner. A treasure hunt is another name for the game, but it may involve following a series of clues to find objects or a single prize in a particular order. 

see [Wikipedia](https://en.wikipedia.org/wiki/Scavenger_hunt)

## How the game works

The game works as follows: A user will be presented a riddle. The riddle will gives a lead to a location in the Vienna city center. To solve the riddle the user will have to find the place in question and share their location within a valid range. Solving one riddle will unlock the next until at the end, the user will have hunted the Schnitzel.

## The zk in the Schnitzelhunt
The zk stands for *zero knowledge* and it's what enables you to (cryptographically) prove that you've successfully completed the game whilst keeping the solutions as well as your shared location private.

## Repository structure

- The smart contract + test scripts live [here](./contracts/src/Schnitzel.ts)
- The UI + E2e tests live [here](./ui/pages/)
- And further documentation on the technical implementation as well as mockups can be found [here](./docs/)

## Ideas to extend this project beyond the current scope
- [x] add e2e test to ensure stability of the UI <> contract
- [x] configure pipeline on github
- [x] Build smart contract using recursion API
- [x] Put snarkyJS functions behind a web worker
- [ ] Update snarkyJS version
- [ ] User setup/login
- [ ] Deploy on Berkley
- [ ] Conduct manual test with deployed app (phone/tablet)
- [ ] Leaderboard: present proofs of winners 
- [ ] Include a timer 

**Happy Schnitzelhunting!** :sunny:

P.S. no animals were harmed during development of this app 🐷