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
import { Poseidon, Field, Bool } from 'snarkyjs';
import useWindowSize from "./useWindowSize";
import Confetti from 'react-confetti';

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

function MyApp() {

  let doDeploy = true;

  const [lat, setLat] = useState(null);
  const [lng, setLng] = useState(null);
  const [geoHashInt, setGeoHashInt] = useState('');
  const [solution1Map, setSolution1Map] = useState(new Map());
  const [solution2Map, setSolution2Map] = useState(new Map());
  const [solution3Map, setSolution3Map] = useState(new Map());
  let [zkapp, setZkapp] = useState('');
  let [isLoading, setLoading] = useState(false);
  let [isFirstRender, setFirstRender] = useState(true);
  let [showSubmissionSuccess, setSubmissionSuccess] = useState(false);
  let [showSubmissionError, setSubmissionError] = useState(false);
  let [showRiddle1, setShowRiddle1] = useState(true);
  let [showRiddle2, setShowRiddle2] = useState(false);
  let [showRiddle3, setShowRiddle3] = useState(false);
  let [currStep, setCurrStep] = useState(0);
  let [finished, setFinished] = useState(false);
  const windowSize = useWindowSize();

  useEffect(() => {
    console.log('useEffect ran');

    async function deploy() {
      console.log('firstRender '+isFirstRender);
      if (!isFirstRender || isLoading) return;
      setLoading(true);
      setFirstRender(false);
      SchnitzelHunt = await import('../../contracts/build/src/Schnitzel.js');

      if (doQuick) {
        // solution 1 
        const test_geohash1 = geohash.encode_int(48.2107958217, 16.3736155926);
        let hash = Poseidon.hash(Field(+test_geohash1).toFields());
        solution1Map.set(test_geohash1.toString(), 0);
        SchnitzelHunt.Solution1Tree.setLeaf(BigInt(0), hash);

        // solution 2 
        const test_geohash2 = geohash.encode_int(48.2079410492, 16.3716678382);
        hash = Poseidon.hash(Field(+test_geohash2).toFields());
        solution2Map.set(test_geohash2.toString(), 0);
        SchnitzelHunt.Solution2Tree.setLeaf(BigInt(0), hash);

        // solution 3 
        const test_geohash3 = geohash.encode_int(48.2086269882, 16.3725081062);
        hash = Poseidon.hash(Field(+test_geohash3).toFields());
        solution3Map.set(test_geohash3.toString(), 0);
        SchnitzelHunt.Solution3Tree.setLeaf(BigInt(0), hash);
        setSolution1Map(solution1Map);
        setSolution2Map(solution2Map);
        setSolution3Map(solution3Map);
      }

      // setup merkle trees for solution
      if (!doQuick && solution1Map.size == 0) {
        console.log('Building solution merkle trees..');

        let solution1Map = SchnitzelHunt.generate_solution_tree(48.2107356534, 16.3736139593, 48.2108048225, 16.3737322524, SchnitzelHunt.Solution1Tree);
        let solution2Map = SchnitzelHunt.generate_solution_tree(
          48.2079049216,
          16.3716384673,
          48.2079451583,
          16.3717048444,
          SchnitzelHunt.Solution2Tree
        );
        let solution3Map = SchnitzelHunt.generate_solution_tree(
          48.2086269882,
          16.3725081062,
          48.2086858438,
          16.3725546748,
          SchnitzelHunt.Solution3Tree
        );

        setSolution1Map(solution1Map);
        setSolution2Map(solution2Map);
        setSolution3Map(solution3Map);

      } else {
        console.log('Solution1 Merkle tree already built: '+solution1Map.size);
        console.log('Solution2 Merkle tree already built: '+solution2Map.size);
        console.log('Solution3 Merkle tree already built: '+solution3Map.size);
      }
      
      let zkapp = await SchnitzelHunt.deployApp(SchnitzelHunt.Solution1Tree.getRoot(), SchnitzelHunt.Solution2Tree.getRoot(), SchnitzelHunt.Solution3Tree.getRoot(), doProof);
      setZkapp(zkapp);
      setLoading(false);
    }
    if (doDeploy) {
      deploy();
    } else {
      setFirstRender(false);
      setLoading(false);
    }
  }, []);

  function shareLocation() {
    console.log('sharing location..');
    if (showSubmissionError) {
      setSubmissionError(false);
    }
    navigator.geolocation.getCurrentPosition((position) => {
      setLat(position.coords.latitude);
      setLng(position.coords.longitude);
      setGeoHashInt(
        geohash.encode_int(
          position.coords.latitude,
          position.coords.longitude,
        )
      );
    });
  };

  const submit = async (zkapp) => {
    setLoading(true);
    SchnitzelHunt = await import('../../contracts/build/src/Schnitzel.js'); 
    let step = zkapp.getState().step;
    console.log('before submitting location step is : '+step);
    // let location = new CheckIn.LocationCheck(lat, lng);
    // hardcode values for local testing -> replace this by adding e2e test
    let location;
    switch (step) {
      case '0':
        location = new SchnitzelHunt.LocationCheck(48.2107958217, 16.3736155926);
        break;
      case '1':
        location = new SchnitzelHunt.LocationCheck(48.2079410492, 16.3716678382);
        break;
      case '2':
        location = new SchnitzelHunt.LocationCheck(48.2086269882, 16.3725081062);
        break;
      default:
        break;
    }
    await zkapp.hunt(location, solution1Map, solution2Map, solution3Map, +currStep, doProof);
    step = zkapp.getState().step;
    console.log('after submitting location step is now : '+step);
    if (currStep == +step) {
      console.error("solving riddle unsuccessful: did not increase step count");
      setSubmissionError(true);
    } else {
      switch (step) {
        case '0':
          console.log('step is still 0 after submitting location');
          break;
        case '1':
          console.log('case step 1');
          setCurrStep(step);
          setSubmissionSuccess(true);
          break;
        case '2':
          console.log('case step 2');
          setCurrStep(step);
          setSubmissionSuccess(true);
          break;
        case '3':
          console.log('completed all steps, game is finished...');
          await zkapp.finish(doProof);
          let solved = zkapp.getState().solved;
          if (solved == true) {
            console.log('successfully finished game!');
            setSubmissionSuccess(false);
            setShowRiddle3(false);
            setFinished(true);
          }
        default:
          console.error("invalid step");
          break;
      }
    }
    setLat(null);
    setLng(null);
    setLoading(false);
  }

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
        open={isLoading || isFirstRender}
      >
        <CircularProgress color="inherit" />
      </Backdrop>
    </div>
    <div>
        <Container fixed>
            { showRiddle1 &&
              <Box className={styles.riddleBox}>
                <p data-testid="riddle1" className={styles.riddle}>I've got an anchor, but have no sail. My sound makes Hooks' mind derail. Stand underneath, close in the middle, share your location to solve this riddle. </p>
                { currStep == 1 && <FontAwesomeIcon icon={faArrowRight} onClick={() => {
                  setShowRiddle1(false);
                  setShowRiddle2(true);
                  setSubmissionSuccess(false);
                }} style={{color: '#ffafbd', marginLeft: '4rem'}} size="6x" /> }
              </Box>
            }
            {showRiddle2 &&
              <Box className={styles.riddleBox}>
                <p data-testid="riddle2" className={styles.riddle}>Stand close to me half wood / half iron, my creator fooled by a diabolic tyran. No key, no hammer and no rock has ever managed to unlock. </p>
                { currStep == 2 && <FontAwesomeIcon icon={faArrowRight} onClick={() => {
                  setShowRiddle2(false);
                  setShowRiddle3(true);
                  setSubmissionSuccess(false);
                }} style={{color: '#ffafbd', marginLeft: '4rem'}} size="6x" /> }
              </Box>
            }
            {showRiddle3 &&
              <Box className={styles.riddleBox}>
                <p data-testid="riddle3" className={styles.riddle}>To free Austria was our dream, we fought to liberate against the regime. We leave a mark for God to read, may they help us to stop the bleed. </p>
              </Box>
            }
            {finished &&
              <Box className={styles.riddleBox}>
                <p data-testid="finished-message" className={styles.riddle}>Congrats! You successfully hunted the Schnitzel! </p>
              </Box>
            }
            { !showSubmissionSuccess && !finished &&<Box className={styles.locationBox}>
              <p className={styles.location}>
                Solve by sharing your location 👉 <FontAwesomeIcon icon={faLocationDot} onClick={shareLocation} style={{color: '#ffafbd'}} size="2x" />
              </p>
            </Box> }
          {!showSubmissionError && !showSubmissionSuccess && <Box
            className={styles.location}
          >
            <p data-testid="location" >
              {lat && <p>Latitude: {lat}, </p>}
              {lng && <p>Longitude: {lng}</p>}
            </p>
            <p style={{ marginLeft: '20px', marginTop: '10px' }}>
              {lat && lng && (
                <Button
                  data-testid="submit-location" 
                  variant="contained"
                  onClick={()=>{
                    submit(zkapp);
                  }}
                  style={{ backgroundColor: '#ffafbd' }}
                >
                  Submit solution
                </Button>
              )}
            </p>
          </Box>}

          {showSubmissionError && <Box className={styles.locationBox}>
            <p className={styles.submissionError}>
              Wrong Location, try again!
            </p>
        </Box>}

          {showSubmissionSuccess && <Box className={styles.locationBox}>
                <p className={styles.submissionError}>
                  Nice one! 
                </p>
          </Box>}

        </Container>
      </div>
      {finished && <Confetti
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

export default MyApp;