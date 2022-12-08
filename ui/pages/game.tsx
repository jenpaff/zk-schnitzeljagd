import React, { useEffect, useState } from 'react';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import { Backdrop, Box, CircularProgress, Typography } from '@mui/material';
import Head from 'next/head'
import Image from 'next/image'
import homeStyles from '../styles/Home.module.css'
import styles from '../styles/Game.module.css'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLocationDot } from '@fortawesome/free-solid-svg-icons';
import { faArrowRight } from '@fortawesome/free-solid-svg-icons';
import geohash from 'ngeohash';
import { Poseidon, Field, Bool, PublicKey, PrivateKey, Mina, isReady } from 'snarkyjs';
import useWindowSize from "./useWindowSize";
import Confetti from 'react-confetti';
import ZkappWorkerClient from './zkappWorkerClient';
import { SchnitzelHuntApp, MerkleWitness, Solution1Tree, Solution2Tree, Solution3Tree, LocationCheck } from '../../contracts/build/src/Schnitzel.js';

let SchnitzelHunt; // this will hold the dynamically imported './Schnitzel.js'

/*
  when turned off it will skip generating a proof for correct solutions, 
  may be used for quick testing of the logic
*/
let doQuick = false;
/*
  when turned off it only adds one geohash solution to the solutionTree (used for quick testing/showcasing) 
  rather than loading the whole solution tree to allow for a wider range of allowed locations per solution
*/
let doProof = false;

export default function App() {

  let [state, setState] = useState({
    zkappWorkerClient: null as null | ZkappWorkerClient,
    hasWallet: false,
    hasBeenSetup: false,
    accountExists: false,
    currStep: '0',
    finished: false,
    zkappPublicKey: null as null | PublicKey,

    // game stuff 
    lat: null as null | number,
    lng: null as null | number,
    solution1Map: new Map(),
    solution2Map: new Map(),
    solution3Map: new Map(),
    isLoading: false,
    showSubmissionSuccess: false,
    showSubmissionError: false,
    showRiddle1: false,
    showRiddle2: false,
    showRiddle3: false,
  });

  const windowSize = useWindowSize();

  // -------------------------------------------------------
  // Do setup

  useEffect(() => {
    (async () => {

      if (!state.hasBeenSetup) {

        state.isLoading = true;

        const zkappWorkerClient = new ZkappWorkerClient();
        state.zkappWorkerClient = zkappWorkerClient;

        console.log('Loading SnarkyJS...');
        await zkappWorkerClient.loadSnarkyJS();
        console.log('done');
        console.log('Starting local chain...');
        const publicKey = await zkappWorkerClient.setActiveInstanceToLocal();
        state.zkappPublicKey = publicKey;
        const accountExists = true;
        console.log('done');
      
        console.log('Loading Contract...');
        await zkappWorkerClient.loadContract();
        console.log('done');
        
        console.log('Compiling zkApp...');
        await zkappWorkerClient.compileContract();
        console.log('zkApp compiled');

        // setup solution trees
        let solution1Map = new Map();
        let solution2Map = new Map();
        let solution3Map = new Map();

        // solution 1 
        const test_geohash1 = geohash.encode_int(48.2107958217, 16.3736155926);
        let hash = Poseidon.hash(Field(+test_geohash1).toFields());
        solution1Map.set(test_geohash1.toString(), 0);
        Solution1Tree.setLeaf(BigInt(0), hash);

        // solution 2 
        const test_geohash2 = geohash.encode_int(48.2079410492, 16.3716678382);
        hash = Poseidon.hash(Field(+test_geohash2).toFields());
        solution2Map.set(test_geohash2.toString(), 0);
        Solution2Tree.setLeaf(BigInt(0), hash);

        // solution 3 
        const test_geohash3 = geohash.encode_int(48.2086269882, 16.3725081062);
        hash = Poseidon.hash(Field(+test_geohash3).toFields());
        solution3Map.set(test_geohash3.toString(), 0);
        Solution3Tree.setLeaf(BigInt(0), hash);

        console.log('Deploying zkapp...');
        await zkappWorkerClient.deployApp(Solution1Tree.getRoot(), Solution1Tree.getRoot(), Solution3Tree.getRoot());
        console.log('done');

        let currentStep = (await state.zkappWorkerClient!.getStep()).toString();
        let root1 = (await state.zkappWorkerClient!.getRoot1()).toString();
        let finished = (await state.zkappWorkerClient!.getFinished()).toString();

        console.log('root 1: ', root1);
        console.log('currentStep: ', currentStep);
        console.log('finished: ', finished);

        setState({...state,
          zkappWorkerClient,
          hasBeenSetup: true,
          currStep: currentStep.toString(),
          finished: false,
          lat: null,
          lng: null,
          solution1Map,
          solution2Map,
          solution3Map,
          isLoading: false,
          showSubmissionSuccess: false,
          showSubmissionError: false,
          showRiddle1: true,
          showRiddle2: false,
          showRiddle3: false,
        });
      }
    })();
  }, []);

  // -------------------------------------------------------
  // Trigger schnitzelhunt

  const solvingRiddle = async () => {
    console.log('attempting to solve riddle...');
    setState({ ...state, isLoading: true });
    // SchnitzelHunt = await import('../../contracts/build/src/Schnitzel.js'); 
    let currentStep = (await state.zkappWorkerClient!.getStep()).toString();

    console.log('currentStep (before update) ', currentStep);

    // getting shared location
    let sharedLocation = new LocationCheck(48.2107958217, 16.3736155926);
    switch (currentStep) {
      case '0':
        sharedLocation = new LocationCheck(48.2107958217, 16.3736155926);
        break;
      case '1':
        sharedLocation = new LocationCheck(48.2079410492, 16.3716678382);
        break;
      case '2':
        sharedLocation = new LocationCheck(48.2079410492, 16.3716678382);
        break;
      default:
        break;
    }

    // getting merklepath
    let idx;
    let witness;

    switch (currentStep) {
      case '0':
        console.log('attempt to solve step 0');
        idx = state.solution1Map.get(sharedLocation.sharedGeoHash.toString());
        if (idx == undefined) {
          throw console.log('Location shared is incorrect!');
        }
        witness = new MerkleWitness(Solution1Tree.getWitness(BigInt(+idx)));
        break;
      case '1':
        console.log('attempt to solve step 1');
        idx = state.solution2Map.get(sharedLocation.sharedGeoHash.toString());
        if (idx == undefined) {
          throw console.log('Location shared is incorrect!');
        }
        witness = new MerkleWitness(Solution2Tree.getWitness(BigInt(+idx)));
        break;
      case '2':
        console.log('attempt to solve step 2');
        idx = state.solution3Map.get(sharedLocation.sharedGeoHash.toString());
        if (idx == undefined) {
          throw console.log('Location shared is incorrect!');
        }
        witness = new MerkleWitness(Solution3Tree.getWitness(BigInt(+idx)));
        break;
      default:
        throw console.log('Invalid step: ' + currentStep);
    }

    await state.zkappWorkerClient!.createHuntTransaction(sharedLocation, witness);

    let stepAfterSubmit = (await state.zkappWorkerClient!.getStep()).toString();

    if (stepAfterSubmit == (currentStep+1)) {
      state.showSubmissionSuccess = true;
    } else {
      state.showSubmissionError = true;
    }

    currentStep = stepAfterSubmit;

    console.log('currentStep: ', currentStep);

    setState({ ...state, currStep: currentStep, lat: null, lng: null, isLoading: false });
  }

  // -------------------------------------------------------


  // -------------------------------------------------------
  // Trigger finishProcess

  const finishGame = async () => {
    console.log('finshed game... updating state');

    let currentStep = (await state.zkappWorkerClient!.getStep()).toString();

    await state.zkappWorkerClient!.createFinishTransaction();

    currentStep = (await state.zkappWorkerClient!.getStep()).toString();

    setState({ ...state, currStep: currentStep });
  }

  function shareLocation() {
    console.log('sharing location..');
    if (state.showSubmissionError) {
      state.showSubmissionError = false;
    }
    navigator.geolocation.getCurrentPosition((position) => {
      state.lat = position.coords.latitude;
      state.lng = position.coords.longitude;
      setState({ ...state, lat: position.coords.latitude, lng: position.coords.longitude });
    });
  };

  return (
    <div className={styles.container}>
      <Head>
        <title>zk schnitzelhunt</title>
        <meta name="description" content="A zero knowledge treasure hunt game" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

    <main>  

    <div>
      <Backdrop
        sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }}
        open={state.isLoading || !state.hasBeenSetup }
      >
        <CircularProgress color="inherit" />
      </Backdrop>
    </div>
    <div>
        <Container fixed>
            { state.showRiddle1 &&
              <Box className={styles.riddleBox}>
                <p data-testid="riddle1" className={styles.riddle}>I've got an anchor, but have no sail. My sound makes Hooks' mind derail. Stand underneath, close in the middle, share your location to solve this riddle. </p>
                { state.currStep == '1' && <FontAwesomeIcon icon={faArrowRight} onClick={() => {
                  state.showRiddle1 = false;
                  state.showRiddle1 = true;
                  state.showSubmissionSuccess = false;
                }} style={{color: '#ffafbd', marginLeft: '4rem'}} size="6x" /> }
              </Box>
            }
            {state.showRiddle2 &&
              <Box className={styles.riddleBox}>
                <p data-testid="riddle2" className={styles.riddle}>Stand close to me half wood / half iron, my creator fooled by a diabolic tyran. No key, no hammer and no rock has ever managed to unlock. </p>
                { state.currStep == '2' && <FontAwesomeIcon icon={faArrowRight} onClick={() => {
                  state.showRiddle2 = false;
                  state.showRiddle3 = true;
                  state.showSubmissionSuccess = false;
                }} style={{color: '#ffafbd', marginLeft: '4rem'}} size="6x" /> }
              </Box>
            }
            {state.showRiddle3 &&
              <Box className={styles.riddleBox}>
                <p data-testid="riddle3" className={styles.riddle}>To free Austria was our dream, we fought to liberate against the regime. We leave a mark for God to read, may they help us to stop the bleed. </p>
              </Box>
            }
            {state.finished &&
              <Box className={styles.riddleBox}>
                <p data-testid="finished-message" className={styles.riddle}>Congrats! You successfully hunted the Schnitzel! </p>
              </Box>
            }
            { !state.isLoading && !state.showSubmissionSuccess && !state.finished &&<Box className={styles.locationBox}>
              <p className={styles.location}>
                Solve by sharing your location 👉 <FontAwesomeIcon icon={faLocationDot} onClick={shareLocation} style={{color: '#ffafbd'}} size="2x" />
              </p>
            </Box> }
          {!state.showSubmissionError && !state.showSubmissionSuccess && <Box
            className={styles.location}
          >
            <p data-testid="location" >
              {state.lat && <p>Latitude: {state.lat}, </p>}
              {state.lng && <p>Longitude: {state.lng}</p>}
            </p>
            <p style={{ marginLeft: '20px', marginTop: '10px' }}>
              {state.lat && state.lng && (
                <Button
                  data-testid="submit-location" 
                  variant="contained"
                  onClick={solvingRiddle}
                  style={{ backgroundColor: '#ffafbd' }}
                >
                  Submit solution
                </Button>
              )}
            </p>
          </Box>}

          {state.showSubmissionError && <Box className={styles.locationBox}>
            <p className={styles.submissionError}>
              Wrong Location, try again!
            </p>
        </Box>}

          {state.showSubmissionSuccess && <Box className={styles.locationBox}>
                <p className={styles.submissionError}>
                  Nice one! 
                </p>
          </Box>}

        </Container>
      </div>
      {state.finished && <Confetti
      width={windowSize.width}
      height={windowSize.height}/>}
      </main>

      <footer className={homeStyles.footer}>
        <a
          href="https://vercel.com?utm_source=create-next-app&utm_medium=default-template&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          Powered by{' '}
          <span className={homeStyles.logo}>
            <Image src="/vercel.svg" alt="Vercel Logo" width={72} height={16} />
          </span>
        </a>
      </footer>
    </div>
  )
}