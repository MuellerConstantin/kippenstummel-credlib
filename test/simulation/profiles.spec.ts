import * as fs from 'fs';
import * as path from 'path';
import { computeCredibility, BehaviourInfo } from 'src/index';
import {
  generateNormalBehaviour,
  generateBotBehaviour,
  generateNewbieBehaviour,
  generatePowerBehaviour,
  generateSpamBehaviour,
} from './profiles';

describe('ProfileSimulation', () => {
  const simulateProfile = (
    name: string,
    profileGenerator: () => BehaviourInfo,
    count: number,
  ) => {
    const behaviourInfos: BehaviourInfo[] = [];

    for (let index = 0; index < count; index++) {
      const behaviourInfo = profileGenerator();
      behaviourInfos.push(behaviourInfo);
    }

    const credibilities: number[] = [];
    const results: {
      behaviour: BehaviourInfo;
      credibility: number;
      trace: Map<string, number>;
    }[] = [];

    for (const behaviourInfo of behaviourInfos.values()) {
      const result = {
        behaviour: behaviourInfo,
        credibility: 0,
        trace: new Map<string, number>(),
      };

      const credibility = computeCredibility(behaviourInfo, result.trace);

      result.credibility = credibility;
      results.push(result);
      credibilities.push(credibility);
    }

    if (!fs.existsSync(path.resolve(__dirname, './results'))) {
      fs.mkdirSync(path.resolve(__dirname, './results'), {
        recursive: true,
      });
    }

    fs.writeFileSync(
      path.resolve(__dirname, `./results/profile-${name}.json`),
      JSON.stringify(
        results.map((result) => ({
          ...result,
          trace: Object.fromEntries(result.trace),
        })),
      ),
    );

    const average = Number(
      credibilities.reduce((a, b) => a + b, 0) / credibilities.length,
    ).toFixed(2);

    const output = `Profile: ${name}\nAverage Credibility: ${average}\nMin: ${Math.min(...credibilities)} Max: ${Math.max(...credibilities)}`;

    console.log(output);
  };

  describe('simulate', () => {
    it('Should run normal user simulation successfully"', () => {
      simulateProfile('normal', generateNormalBehaviour, 10000);
    });

    it('Should run bot simulation successfully"', () => {
      simulateProfile('bot', generateBotBehaviour, 10000);
    });

    it('Should run spam user simulation successfully"', () => {
      simulateProfile('spam', generateSpamBehaviour, 10000);
    });

    it('Should run newbie user simulation successfully"', () => {
      simulateProfile('newbie', generateNewbieBehaviour, 10000);
    });

    it('Should run power user simulation successfully"', () => {
      simulateProfile('power', generatePowerBehaviour, 10000);
    });
  });
});
