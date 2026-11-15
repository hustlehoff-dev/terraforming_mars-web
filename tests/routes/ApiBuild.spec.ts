import {expect} from 'chai';
import * as fs from 'fs';
import {ApiBuild} from '../../src/server/routes/ApiBuild';
import {MockResponse} from './HttpMocks';
import {RouteTestScaffolding} from './RouteTestScaffolding';

describe('ApiBuild', () => {
  it('answers the id of the client build this server serves', async () => {
    const scaffolding = new RouteTestScaffolding();
    scaffolding.url = '/api/build';
    const res = new MockResponse();
    await scaffolding.get(ApiBuild.INSTANCE, res);
    const expected = fs.existsSync('build/build-id.txt') ? fs.readFileSync('build/build-id.txt', 'utf8').trim() : '';
    expect(JSON.parse(res.content)).deep.eq({build: expected});
  });
});
