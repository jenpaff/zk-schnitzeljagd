# zk schnitzelhunt contracts

During development, I started with an iterative contract which I called `Schnitzel.ts`. Due to the nature of my zkapp, the possibility of using a recursive contract is something I wanted to try and therefore developed a recursive version of the contract.

## How to build

```sh
npm run build
```

# How to run test script

Run iterative contract

```sh
npx tsc && node build/src/run.js
```

Run recursive contract

```sh
npx tsc && node build/src/run-recursive.js
```

## How to run tests

```sh
npm run test
npm run testw # watch mode
```

## How to run coverage

```sh
npm run coverage
```

## License

[Apache-2.0](LICENSE)
