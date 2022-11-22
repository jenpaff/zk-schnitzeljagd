import { Field } from 'snarkyjs';
import geohash from 'ngeohash';
import { Poseidon } from 'snarkyjs';
import fs from 'fs';

export function write_solution_map_to_file(
  filename: string,
  minlat: number,
  minlong: number,
  maxlat: number,
  maxlong: number
) {
  console.log('writing to file ' + filename);
  // get bounding box geohash integers
  const solution = geohash
    .bboxes_int(minlat, minlong, maxlat, maxlong)
    .toString()
    .split(',');
  console.log(solution.length);

  for (let index = 0; index < solution.length; index++) {
    const geoHashInt = +solution[index];
    let hash = Poseidon.hash(Field(geoHashInt).toFields());
    console.log('index: ' + index + ' geohash HASH: ' + hash);
    fs.appendFileSync(filename, '\n' + index + ':' + hash);
    fs.appendFileSync(
      filename + '_geohashes.txt',
      '\n' + index + ':' + geoHashInt
    );
  }
}
