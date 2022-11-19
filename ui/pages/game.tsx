import React, { useEffect, useState } from 'react';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import { Backdrop, Box, CircularProgress } from '@mui/material';
import Head from 'next/head'
import Image from 'next/image'
import homeStyles from '../styles/Home.module.css'
import styles from '../styles/Game.module.css'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLocationDot } from '@fortawesome/free-solid-svg-icons';
import { faArrowRight } from '@fortawesome/free-solid-svg-icons';
import geohash from 'ngeohash';
import { Poseidon, Field, Bool } from 'snarkyjs';
// import { CheckIn } from 'zk-schnitzelhunt';

let SchitzelHunt; // this will hold the dynamically imported './sudoku-zkapp.ts'

let doProof = false;

function MyApp() {

  let doDeploy = true;
  let doQuick = true;

  const [lat, setLat] = useState(null);
  const [lng, setLng] = useState(null);
  const [geoHash, setGeoHash] = useState('');
  const [geoHashInt, setGeoHashInt] = useState('');
  const [solution1Map, setSolution1Map] = useState(new Map());
  const [solution2Map, setSolution2Map] = useState(new Map());
  let [zkapp, setZkapp] = useState('');
  let [isLoading, setLoading] = useState(false);
  let [isFirstRender, setFirstRender] = useState(true);
  let [showSubmissionSuccess, setSubmissionSuccess] = useState(false);
  let [showSubmissionError, setSubmissionError] = useState(false);
  let [showRiddle1, setShowRiddle1] = useState(true);
  let [showRiddle2, setShowRiddle2] = useState(false);
  let [currStep, setCurrStep] = useState(0);

  useEffect(() => {
    console.log('useEffect ran');

    async function deploy() {
      console.log('firstRender '+isFirstRender);
      if (!isFirstRender || isLoading) return;
      setFirstRender(false);
      setLoading(true);
      SchitzelHunt = await import('../../contracts/build/src/Schnitzel.js');

      if (doQuick) {
        const test_geohash = geohash.encode_int(48.2107958217, 16.3736155926);
        console.log('test_geohash ' + test_geohash);
        let hash = Poseidon.hash(Field(+test_geohash).toFields());
        console.log('hash ' + hash);
        solution1Map.set(test_geohash.toString(), 0);
        solution2Map.set(test_geohash.toString(), 0);
        SchitzelHunt.Solution1Tree.setLeaf(BigInt(0), hash);
        SchitzelHunt.Solution2Tree.setLeaf(BigInt(0), hash);
      }

      // setup merkle tree for solution 1
      if (!doQuick && solution1Map.size == 0) {
        console.log('Building solution1 merkle tree..');
        const solution1 = geohash.bboxes_int(48.2107356534, 16.3736139593, 48.2108048225, 16.3737322524);
        for (let index = 0; index < solution1.length; index++) {
          let map_index = BigInt(index);
          let hash = Poseidon.hash(Field(+solution1[index]).toFields());
          console.log('index: ' + index + ' geohash HASH: ' + hash);
          solution1Map.set(solution1[index].toString(), index);
          solution2Map.set(solution1[index].toString(), index);
          SchitzelHunt.Solution1Tree.setLeaf(map_index, hash);
          SchitzelHunt.Solution2Tree.setLeaf(map_index, hash);
        }
        setSolution1Map(solution1Map);
        setSolution2Map(solution2Map);
      } else {
        console.log('Solution1 Merkle tree already built: '+solution1Map.size);
        console.log('Solution2 Merkle tree already built: '+solution2Map.size);
      }
      
      let zkapp = await SchitzelHunt.deployApp(SchitzelHunt.Solution1Tree.getRoot(), SchitzelHunt.Solution2Tree.getRoot(), doProof);
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
      console.log('Latitude is :', position.coords.latitude);
      console.log('Longitude is :', position.coords.longitude);
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
    console.log('Submitting location: '+lat+','+lng);
    setLoading(true);
    SchitzelHunt = await import('../../contracts/build/src/Schnitzel.js');
    let location = new SchitzelHunt.LocationCheck(48.2107958217, 16.3736155926);
    await zkapp.hunt(location, solution1Map, solution2Map, +currStep, doProof);
    let step = zkapp.getState().step;
    console.log('step '+step);
    // let location = new CheckIn.LocationCheck(lat, lng);
    switch (step) {
      case '0':
        console.log('step is still 0 after submitting location');
        setSubmissionError(true);
        break;
      case '1':
        if (+currStep.toString() < step) {
          setCurrStep(step);
          setSubmissionSuccess(true);
        } else {
          console.error("discrepancy between steps count");
        }
      case '2':
        if (+currStep.toString() < step) {
          setCurrStep(step);
          setSubmissionSuccess(true);
        } else {
          console.error("discrepancy between steps count");
        }
        await zkapp.finish(doProof);
        let solved = zkapp.getState().solved;
        if (solved == true) {
          console.log('yay');
        }
      default:
        break;
    }
    setLat(null);
    setLng(null);
    setLoading(false);
  }

  return (
    <div className={styles.container}>
      <Head>
        <title>zk schnitzeljagd</title>
        <meta name="description" content="Generated by create next app" />
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
                <p className={styles.riddle}>I've got an anchor, but have no sail. My sound makes Hooks' mind derail. Stand underneath, close in the middle, share your location to solve this riddle. </p>
                { currStep == 1 && <FontAwesomeIcon icon={faArrowRight} onClick={() => {
                  setShowRiddle1(false);
                  setShowRiddle2(true);
                  setSubmissionSuccess(false);
                }} style={{color: '#ffafbd', marginLeft: '4rem'}} size="6x" /> }
              </Box>
            }
            {showRiddle2 &&
              <Box className={styles.riddleBox}>
                <p className={styles.riddle}>Stand close to me half wood / half iron, my creator foold by a diabolic tyran. No key, no hammer and no rock has ever managed to unlock. </p>
              </Box>
            }
            <Box className={styles.locationBox}>
              <p className={styles.location}>
                Solve by sharing your location 👉 <FontAwesomeIcon icon={faLocationDot} onClick={shareLocation} style={{color: '#ffafbd'}} size="2x" />
              </p>
            </Box>
          {!showSubmissionError && !showSubmissionSuccess && <Box
            className={styles.location}
          >
            <p>
              {lat && <p>Latitude: {lat}, </p>}
              {lng && <p>Longitude: {lng}</p>}
            </p>
            <p style={{ marginLeft: '20px', marginTop: '10px' }}>
              {lat && lng && (
                <Button
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