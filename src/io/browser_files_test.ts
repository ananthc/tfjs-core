/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */

/**
 * Unit tests for file-related IOHandlers.
 */

import * as tf from '../index';
import {describeWithFlags} from '../jasmine_util';
import {CPU_ENVS} from '../test_util';

import {WeightsManifestConfig, WeightsManifestEntry} from './types';

const modelTopology1: {} = {
  'class_name': 'Sequential',
  'keras_version': '2.1.4',
  'config': [{
    'class_name': 'Dense',
    'config': {
      'kernel_initializer': {
        'class_name': 'VarianceScaling',
        'config': {
          'distribution': 'uniform',
          'scale': 1.0,
          'seed': null,
          'mode': 'fan_avg'
        }
      },
      'name': 'dense',
      'kernel_constraint': null,
      'bias_regularizer': null,
      'bias_constraint': null,
      'dtype': 'float32',
      'activation': 'linear',
      'trainable': true,
      'kernel_regularizer': null,
      'bias_initializer': {'class_name': 'Zeros', 'config': {}},
      'units': 1,
      'batch_input_shape': [null, 3],
      'use_bias': true,
      'activity_regularizer': null
    }
  }],
  'backend': 'tensorflow'
};
const weightSpecs1: tf.io.WeightsManifestEntry[] = [
  {
    name: 'dense/kernel',
    shape: [3, 1],
    dtype: 'float32',
  },
  {
    name: 'dense/bias',
    shape: [1],
    dtype: 'float32',
  }
];
const weightData1 = new ArrayBuffer(16);
const artifacts1: tf.io.ModelArtifacts = {
  modelTopology: modelTopology1,
  weightSpecs: weightSpecs1,
  weightData: weightData1,
};

describeWithFlags('browserDownloads', CPU_ENVS, () => {
  class FakeHTMLAnchorElement {
    download: string;
    href: string;
    clicked: number;

    constructor() {
      this.clicked = 0;
    }

    click() {
      this.clicked++;
    }
  }

  let fakeAnchors: FakeHTMLAnchorElement[] = [];
  let fakeAnchorCount = 0;

  beforeEach(() => {
    fakeAnchorCount = 0;
    fakeAnchors = [new FakeHTMLAnchorElement(), new FakeHTMLAnchorElement()];
    spyOn(document, 'createElement').and.callFake((tag: string) => {
      return fakeAnchors[fakeAnchorCount++];
    });
  });

  it('Explicit file name prefix, with existing anchors', async done => {
    const testStartDate = new Date();
    const downloadTrigger = tf.io.browserDownloads('test-model');
    downloadTrigger.save(artifacts1)
        .then(async saveResult => {
          expect(saveResult.errors).toEqual(undefined);
          const artifactsInfo = saveResult.modelArtifactsInfo;
          expect(artifactsInfo.dateSaved.getTime())
              .toBeGreaterThanOrEqual(testStartDate.getTime());
          expect(saveResult.modelArtifactsInfo.modelTopologyBytes)
              .toEqual(JSON.stringify(modelTopology1).length);
          expect(saveResult.modelArtifactsInfo.weightSpecsBytes)
              .toEqual(JSON.stringify(weightSpecs1).length);
          expect(saveResult.modelArtifactsInfo.weightDataBytes).toEqual(16);

          const jsonAnchor = fakeAnchors[0];
          const weightDataAnchor = fakeAnchors[1];
          expect(jsonAnchor.download).toEqual('test-model.json');
          expect(weightDataAnchor.download).toEqual('test-model.weights.bin');

          // Verify the content of the JSON file.
          const jsonContent = await fetch(jsonAnchor.href);
          const modelTopologyAndWeightsManifest =
              JSON.parse(await jsonContent.text());
          expect(modelTopologyAndWeightsManifest.modelTopology)
              .toEqual(modelTopology1);
          const weightsManifest =
              modelTopologyAndWeightsManifest.weightsManifest as
              WeightsManifestConfig;
          expect(weightsManifest.length).toEqual(1);
          expect(weightsManifest[0].paths).toEqual([
            './test-model.weights.bin'
          ]);
          expect(weightsManifest[0].weights).toEqual(weightSpecs1);

          // Verify the content of the binary weights file.
          const weightsContent = await fetch(weightDataAnchor.href);
          const fileReader = new FileReader();
          // tslint:disable-next-line:no-any
          fileReader.onload = (event: any) => {
            const buffer = event.target.result as ArrayBuffer;
            expect(buffer).toEqual(weightData1);
            done();
          };
          fileReader.readAsArrayBuffer(await weightsContent.blob());

          // Verify that the downloads are triggered through clicks.
          expect(jsonAnchor.clicked).toEqual(1);
          expect(weightDataAnchor.clicked).toEqual(1);
        })
        .catch(err => {
          done.fail(err.stack);
        });
  });

  it('No file name provided, with existing anchors', async done => {
    const testStartDate = new Date();
    const downloadTrigger = tf.io.browserDownloads();
    downloadTrigger.save(artifacts1)
        .then(async saveResult => {
          expect(saveResult.errors).toEqual(undefined);
          const artifactsInfo = saveResult.modelArtifactsInfo;
          expect(artifactsInfo.dateSaved.getTime())
              .toBeGreaterThanOrEqual(testStartDate.getTime());
          expect(saveResult.modelArtifactsInfo.modelTopologyBytes)
              .toEqual(JSON.stringify(modelTopology1).length);
          expect(saveResult.modelArtifactsInfo.weightSpecsBytes)
              .toEqual(JSON.stringify(weightSpecs1).length);
          expect(saveResult.modelArtifactsInfo.weightDataBytes).toEqual(16);

          const jsonAnchor = fakeAnchors[0];
          const weightDataAnchor = fakeAnchors[1];

          // Verify that the default file names are used.
          expect(jsonAnchor.download).toEqual('model.json');
          expect(weightDataAnchor.download).toEqual('model.weights.bin');

          // Verify the content of the JSON file.
          const jsonContent = await fetch(jsonAnchor.href);
          const modelTopologyAndWeightsManifest =
              JSON.parse(await jsonContent.text());
          expect(modelTopologyAndWeightsManifest.modelTopology)
              .toEqual(modelTopology1);
          const weightsManifest =
              modelTopologyAndWeightsManifest.weightsManifest as
              WeightsManifestConfig;
          expect(weightsManifest.length).toEqual(1);
          expect(weightsManifest[0].paths).toEqual(['./model.weights.bin']);
          expect(weightsManifest[0].weights).toEqual(weightSpecs1);

          // Verify the content of the binary weights file.
          const weightsContent = await fetch(weightDataAnchor.href);
          const fileReader = new FileReader();
          // tslint:disable-next-line:no-any
          fileReader.onload = (event: any) => {
            const buffer = event.target.result as ArrayBuffer;
            expect(buffer).toEqual(weightData1);
            done();
          };
          fileReader.readAsArrayBuffer(await weightsContent.blob());
        })
        .catch(err => {
          done.fail(err.stack);
        });
  });

  it('Download only model topology', async done => {
    const testStartDate = new Date();
    const downloadTrigger = tf.io.browserDownloads();
    const modelTopologyOnlyArtifacts: tf.io.ModelArtifacts = {
      modelTopology: modelTopology1,
    };
    downloadTrigger.save(modelTopologyOnlyArtifacts)
        .then(async saveResult => {
          expect(saveResult.errors).toEqual(undefined);
          const artifactsInfo = saveResult.modelArtifactsInfo;
          expect(artifactsInfo.dateSaved.getTime())
              .toBeGreaterThanOrEqual(testStartDate.getTime());
          expect(saveResult.modelArtifactsInfo.modelTopologyBytes)
              .toEqual(JSON.stringify(modelTopology1).length);
          expect(saveResult.modelArtifactsInfo.weightSpecsBytes).toEqual(0);
          expect(saveResult.modelArtifactsInfo.weightDataBytes).toEqual(0);

          const jsonAnchor = fakeAnchors[0];
          const weightDataAnchor = fakeAnchors[1];

          // Verify that the default file names are used.
          expect(jsonAnchor.download).toEqual('model.json');
          expect(jsonAnchor.clicked).toEqual(1);
          // The weight file should not have been downoaded.
          expect(weightDataAnchor.download).toEqual(undefined);
          expect(weightDataAnchor.clicked).toEqual(0);

          // Verify the content of the JSON file.
          const jsonContent = await fetch(jsonAnchor.href);
          const modelTopologyAndWeightsManifest =
              JSON.parse(await jsonContent.text());
          expect(modelTopologyAndWeightsManifest.modelTopology)
              .toEqual(modelTopology1);
          done();
        })
        .catch(err => {
          done.fail(err.stack);
        });
  });
});

describeWithFlags('browserFiles', CPU_ENVS, () => {
  const weightsBlob =
      new Blob([weightData1], {type: 'application/octet-stream'});
  const weightsFile = new File(
      [weightsBlob], 'model.weights.bin', {type: 'application/octet-stream'});

  it('One group, one path', async done => {
    const weightsManifest: WeightsManifestConfig = [{
      paths: ['./model.weights.bin'],
      weights: weightSpecs1,
    }];
    const weightsTopologyAndManifest = {
      modelTopology: modelTopology1,
      weightsManifest,
    };
    const jsonBlob = new Blob(
        [JSON.stringify(weightsTopologyAndManifest)],
        {type: 'application/json'});
    const jsonFile =
        new File([jsonBlob], 'model.json', {type: 'application/json'});

    const filesHandler = tf.io.browserFiles([jsonFile, weightsFile]);
    filesHandler.load()
        .then(modelArtifacts => {
          expect(modelArtifacts.modelTopology).toEqual(modelTopology1);
          expect(modelArtifacts.weightSpecs).toEqual(weightSpecs1);
          expect(new Uint8Array(modelArtifacts.weightData))
              .toEqual(new Uint8Array(weightData1));
          done();
        })
        .catch(err => {
          done.fail(err.stack);
        });
  });

  it(`One group, two paths`, async done => {
    const weightSpecs: WeightsManifestEntry[] = [
      {
        name: 'foo',
        shape: [1, 1],
        dtype: 'float32',
      },
      {
        name: 'bar',
        shape: [1, 1],
        dtype: 'float32',
      }
    ];
    const weightsManifest: WeightsManifestConfig = [{
      paths: ['./dir1/model.weights.1.bin', './dir2/model.weights.2.bin'],
      weights: weightSpecs,
    }];
    const weightsTopologyAndManifest = {
      modelTopology: modelTopology1,
      weightsManifest,
    };
    const weightsBlob1 = new Blob(
        [new Uint8Array([1, 2, 3, 4]).buffer],
        {type: 'application/octet-stream'});
    const weightsFile1 = new File(
        [weightsBlob1], 'model.weights.1.bin',
        {type: 'application/octet-stream'});
    const weightsBlob2 = new Blob(
        [new Uint8Array([10, 20, 30, 40]).buffer],
        {type: 'application/octet-stream'});
    const weightsFile2 = new File(
        [weightsBlob2], 'model.weights.2.bin',
        {type: 'application/octet-stream'});

    const jsonBlob = new Blob(
        [JSON.stringify(weightsTopologyAndManifest)],
        {type: 'application/json'});
    const jsonFile =
        new File([jsonBlob], 'model.json', {type: 'application/json'});

    const filesHandler =
        tf.io.browserFiles([jsonFile, weightsFile1, weightsFile2]);
    filesHandler.load()
        .then(modelArtifacts => {
          expect(modelArtifacts.modelTopology).toEqual(modelTopology1);
          expect(modelArtifacts.weightSpecs).toEqual(weightSpecs);
          expect(new Uint8Array(modelArtifacts.weightData))
              .toEqual(new Uint8Array([1, 2, 3, 4, 10, 20, 30, 40]));
          done();
        })
        .catch(err => {
          done.fail(err.stack);
        });
  });

  it(`Two groups, four paths, reverseOrder=false`, async done => {
    const weightSpecs1: WeightsManifestEntry[] = [
      {
        name: 'foo',
        shape: [1, 1],
        dtype: 'float32',
      },
      {
        name: 'bar',
        shape: [1, 1],
        dtype: 'float32',
      }
    ];
    const weightSpecs2: WeightsManifestEntry[] = [
      {
        name: 'baz',
        shape: [1, 1],
        dtype: 'float32',
      },
      {
        name: 'qux',
        shape: [1, 1],
        dtype: 'float32',
      }
    ];
    const weightsManifest: WeightsManifestConfig = [
      {
        paths: ['./model.weights.1.bin', './model.weights.2.bin'],
        weights: weightSpecs1,
      },
      {
        paths: ['./model.weights.3.bin', './model.weights.4.bin'],
        weights: weightSpecs2,
      }
    ];
    const weightsTopologyAndManifest = {
      modelTopology: modelTopology1,
      weightsManifest,
    };
    const weightsBlob1 = new Blob(
        [new Uint8Array([1, 3, 5, 7]).buffer],
        {type: 'application/octet-stream'});
    const weightsFile1 = new File(
        [weightsBlob1], 'model.weights.1.bin',
        {type: 'application/octet-stream'});
    const weightsBlob2 = new Blob(
        [new Uint8Array([10, 30, 50, 70]).buffer],
        {type: 'application/octet-stream'});
    const weightsFile2 = new File(
        [weightsBlob2], 'model.weights.2.bin',
        {type: 'application/octet-stream'});
    const weightsBlob3 = new Blob(
        [new Uint8Array([2, 4, 6, 8]).buffer],
        {type: 'application/octet-stream'});
    const weightsFile3 = new File(
        [weightsBlob3], 'model.weights.3.bin',
        {type: 'application/octet-stream'});
    const weightsBlob4 = new Blob(
        [new Uint8Array([20, 40, 60, 80]).buffer],
        {type: 'application/octet-stream'});
    const weightsFile4 = new File(
        [weightsBlob4], 'model.weights.4.bin',
        {type: 'application/octet-stream'});

    const jsonBlob = new Blob(
        [JSON.stringify(weightsTopologyAndManifest)],
        {type: 'application/json'});
    const jsonFile =
        new File([jsonBlob], 'model.json', {type: 'application/json'});

    const filesHandler = tf.io.browserFiles(
        [jsonFile, weightsFile1, weightsFile2, weightsFile3, weightsFile4]);
    filesHandler.load()
        .then(modelArtifacts => {
          expect(modelArtifacts.modelTopology).toEqual(modelTopology1);
          expect(modelArtifacts.weightSpecs)
              .toEqual(weightSpecs1.concat(weightSpecs2));
          expect(new Uint8Array(modelArtifacts.weightData))
              .toEqual(new Uint8Array(
                  [1, 3, 5, 7, 10, 30, 50, 70, 2, 4, 6, 8, 20, 40, 60, 80]));
          done();
        })
        .catch(err => {
          done.fail(err.stack);
        });
  });

  it(`Two groups, four paths, reverseOrder=true`, async done => {
    const weightSpecs1: WeightsManifestEntry[] = [
      {
        name: 'foo',
        shape: [1, 1],
        dtype: 'float32',
      },
      {
        name: 'bar',
        shape: [1, 1],
        dtype: 'float32',
      }
    ];
    const weightSpecs2: WeightsManifestEntry[] = [
      {
        name: 'baz',
        shape: [1, 1],
        dtype: 'float32',
      },
      {
        name: 'qux',
        shape: [1, 1],
        dtype: 'float32',
      }
    ];
    const weightsManifest: WeightsManifestConfig = [
      {
        paths: ['./model.weights.1.bin', './model.weights.2.bin'],
        weights: weightSpecs1,
      },
      {
        paths: ['./model.weights.3.bin', './model.weights.4.bin'],
        weights: weightSpecs2,
      }
    ];
    const weightsTopologyAndManifest = {
      modelTopology: modelTopology1,
      weightsManifest,
    };
    const weightsBlob1 = new Blob(
        [new Uint8Array([1, 3, 5, 7]).buffer],
        {type: 'application/octet-stream'});
    const weightsFile1 = new File(
        [weightsBlob1], 'model.weights.1.bin',
        {type: 'application/octet-stream'});
    const weightsBlob2 = new Blob(
        [new Uint8Array([10, 30, 50, 70]).buffer],
        {type: 'application/octet-stream'});
    const weightsFile2 = new File(
        [weightsBlob2], 'model.weights.2.bin',
        {type: 'application/octet-stream'});
    const weightsBlob3 = new Blob(
        [new Uint8Array([2, 4, 6, 8]).buffer],
        {type: 'application/octet-stream'});
    const weightsFile3 = new File(
        [weightsBlob3], 'model.weights.3.bin',
        {type: 'application/octet-stream'});
    const weightsBlob4 = new Blob(
        [new Uint8Array([20, 40, 60, 80]).buffer],
        {type: 'application/octet-stream'});
    const weightsFile4 = new File(
        [weightsBlob4], 'model.weights.4.bin',
        {type: 'application/octet-stream'});

    const jsonBlob = new Blob(
        [JSON.stringify(weightsTopologyAndManifest)],
        {type: 'application/json'});
    const jsonFile =
        new File([jsonBlob], 'model.json', {type: 'application/json'});

    const filesHandler = tf.io.browserFiles(
        [jsonFile, weightsFile4, weightsFile3, weightsFile2, weightsFile1]);
    filesHandler.load()
        .then(modelArtifacts => {
          expect(modelArtifacts.modelTopology).toEqual(modelTopology1);
          expect(modelArtifacts.weightSpecs)
              .toEqual(weightSpecs1.concat(weightSpecs2));
          expect(new Uint8Array(modelArtifacts.weightData))
              .toEqual(new Uint8Array(
                  [1, 3, 5, 7, 10, 30, 50, 70, 2, 4, 6, 8, 20, 40, 60, 80]));
          done();
        })
        .catch(err => {
          done.fail(err.stack);
        });
  });

  it('Upload model topology only', async done => {
    const weightsManifest: WeightsManifestConfig = [{
      paths: ['./model.weights.bin'],
      weights: weightSpecs1,
    }];
    const weightsTopologyAndManifest = {
      modelTopology: modelTopology1,
      weightsManifest,
    };
    const jsonBlob = new Blob(
        [JSON.stringify(weightsTopologyAndManifest)],
        {type: 'application/json'});
    const jsonFile =
        new File([jsonBlob], 'model.json', {type: 'application/json'});

    // Select only a JSON file.
    const filesHandler = tf.io.browserFiles([jsonFile]);
    filesHandler.load()
        .then(modelArtifacts => {
          expect(modelArtifacts.modelTopology).toEqual(modelTopology1);
          expect(modelArtifacts.weightSpecs).toEqual(undefined);
          done();
        })
        .catch(err => {
          done.fail(err.stack);
        });
  });

  it('Mismatch in number of paths and number of files', async done => {
    const weightsManifest: WeightsManifestConfig = [{
      paths: ['./model.weights.1.bin'],
      weights: weightSpecs1,
    }];
    const weightsTopologyAndManifest = {
      modelTopology: weightSpecs1,
      weightsManifest,
    };
    const weightsBlob1 = new Blob(
        [new Uint8Array([1, 2, 3, 4]).buffer],
        {type: 'application/octet-stream'});
    const weightsFile1 = new File(
        [weightsBlob1], 'model.weights.1.bin',
        {type: 'application/octet-stream'});
    const weightsBlob2 = new Blob(
        [new Uint8Array([10, 20, 30, 40]).buffer],
        {type: 'application/octet-stream'});
    const weightsFile2 = new File(
        [weightsBlob2], 'model.weights.2.bin',
        {type: 'application/octet-stream'});

    const jsonBlob = new Blob(
        [JSON.stringify(weightsTopologyAndManifest)],
        {type: 'application/json'});
    const jsonFile =
        new File([jsonBlob], 'model.json', {type: 'application/json'});

    // Supply two weights files while the manifest has only one path. This is
    // expected to fail.
    const filesHandler =
        tf.io.browserFiles([jsonFile, weightsFile2, weightsFile1]);
    filesHandler.load()
        .then(modelArtifacts => {
          done.fail(
              'Loading with mismatch in number of paths and number of files ' +
              'succeeded unexpectedly.');
        })
        .catch(err => {
          expect(err.message)
              .toEqual(
                  'Mismatch in the number of files in weights manifest (1) ' +
                  'and the number of weight files provided (2).');
          done();
        });
  });

  it('Mismatch in manifest paths and file names', async done => {
    const weightSpecs: WeightsManifestEntry[] = [
      {
        name: 'foo',
        shape: [1, 1],
        dtype: 'float32',
      },
      {
        name: 'bar',
        shape: [1, 1],
        dtype: 'float32',
      }
    ];
    const weightsManifest: WeightsManifestConfig = [{
      paths: ['./model.weights.1.bin', './model.weights.2.bin'],
      weights: weightSpecs,
    }];
    const weightsTopologyAndManifest = {
      modelTopology: modelTopology1,
      weightsManifest,
    };
    const weightsBlob1 = new Blob(
        [new Uint8Array([1, 2, 3, 4]).buffer],
        {type: 'application/octet-stream'});
    const weightsFile1 = new File(
        [weightsBlob1], 'model.weights.1.bin',
        {type: 'application/octet-stream'});
    const weightsBlob2 = new Blob(
        [new Uint8Array([10, 20, 30, 40]).buffer],
        {type: 'application/octet-stream'});
    const weightsFile2 = new File(
        [weightsBlob2], 'model.weights.3.bin',
        {type: 'application/octet-stream'});
    // Notice the wrong file name here. It is expected to cause load() to fail.

    const jsonBlob = new Blob(
        [JSON.stringify(weightsTopologyAndManifest)],
        {type: 'application/json'});
    const jsonFile =
        new File([jsonBlob], 'model.json', {type: 'application/json'});

    const filesHandler =
        tf.io.browserFiles([jsonFile, weightsFile1, weightsFile2]);
    filesHandler.load()
        .then(modelArtifacts => {
          done.fail(
              'Loading with mismatching paths and file names ' +
              'succeeded unexpectedly.');
        })
        .catch(err => {
          expect(err.message)
              .toEqual(
                  'Weight file with basename \'model.weights.2.bin\' is not ' +
                  'provided.');
          done();
        });
  });

  it('Duplicate basenames in paths fails', async done => {
    const weightSpecs: WeightsManifestEntry[] = [
      {
        name: 'foo',
        shape: [1, 1],
        dtype: 'float32',
      },
      {
        name: 'bar',
        shape: [1, 1],
        dtype: 'float32',
      }
    ];
    // Notice the duplicate basenames here (albeit distinct full paths). This
    // is expected to cause load() to fail.
    const weightsManifest: WeightsManifestConfig = [{
      paths: ['./dir1/model.weights.1.bin', './dir2/model.weights.1.bin'],
      weights: weightSpecs,
    }];
    const weightsTopologyAndManifest = {
      modelTopology: modelTopology1,
      weightsManifest,
    };
    const weightsBlob1 = new Blob(
        [new Uint8Array([1, 2, 3, 4]).buffer],
        {type: 'application/octet-stream'});
    const weightsFile1 = new File(
        [weightsBlob1], 'model.weights.1.bin',
        {type: 'application/octet-stream'});
    const weightsBlob2 = new Blob(
        [new Uint8Array([10, 20, 30, 40]).buffer],
        {type: 'application/octet-stream'});
    const weightsFile2 = new File(
        [weightsBlob2], 'model.weights.2.bin',
        {type: 'application/octet-stream'});
    // Notice the wrong file name here. It is expected to cause load() to fail.

    const jsonBlob = new Blob(
        [JSON.stringify(weightsTopologyAndManifest)],
        {type: 'application/json'});
    const jsonFile =
        new File([jsonBlob], 'model.json', {type: 'application/json'});

    const filesHandler =
        tf.io.browserFiles([jsonFile, weightsFile1, weightsFile2]);
    filesHandler.load()
        .then(modelArtifacts => {
          done.fail(
              'Loading with duplicate basenames in paths ' +
              'succeeded unexpectedly.');
        })
        .catch(err => {
          expect(err.message)
              .toEqual(
                  'Duplicate file basename found in weights manifest: ' +
                  '\'model.weights.1.bin\'');
          done();
        });
  });

  it('Missing modelTopology from JSON leads to Error', async done => {
    const weightsManifest: WeightsManifestConfig = [{
      paths: ['./model.weights.bin'],
      weights: weightSpecs1,
    }];
    const weightsTopologyAndManifest = {
      weightsManifest,
    };
    const jsonBlob = new Blob(
        [JSON.stringify(weightsTopologyAndManifest)],
        {type: 'application/json'});
    const jsonFile =
        new File([jsonBlob], 'model.json', {type: 'application/json'});

    const filesHandler = tf.io.browserFiles([jsonFile, weightsFile]);
    filesHandler.load()
        .then(modelArtifacts => {
          done.fail(
              'Loading with Files IOHandler with missing modelTopology ' +
              'succeeded unexpectedly.');
        })
        .catch(err => {
          expect(err.message)
              .toMatch(/modelTopology field is missing from file model\.json/);
          done();
        });
  });

  it('Incorrect number of files leads to Error', () => {
    expect(() => tf.io.browserFiles(null)).toThrowError(/at least 1 file/);
    expect(() => tf.io.browserFiles([])).toThrowError(/at least 1 file/);
  });
});
