import { PersonalityEngine, AiMood } from './PersonalityEngine';

describe('PersonalityEngine', () => {
  let engine: PersonalityEngine;

  beforeEach(() => {
    engine = new PersonalityEngine();
    // Mock Math.random to always return 0 (picks the first template)
    jest.spyOn(global.Math, 'random').mockReturnValue(0);
  });

  afterEach(() => {
    jest.spyOn(global.Math, 'random').mockRestore();
  });

  it('should generate a message when mood changes to PANIC', () => {
    const ctx = { mood: 'PANIC' as AiMood, userName: 'Marcin' };
    const message = engine.generateMessage(ctx);
    expect(message).toBe('Houston, mamy problem. Sprint się sypie 🚨.');
  });

  it('should stay silent if there is no significant change', () => {
    const ctx1 = {
      mood: 'STABLE' as AiMood,
      userName: 'Marcin',
      focusScore: 60,
    };
    engine.generateMessage(ctx1);

    const ctx2 = {
      mood: 'STABLE' as AiMood,
      userName: 'Marcin',
      focusScore: 62,
    }; // Small change
    const msg2 = engine.generateMessage(ctx2);

    expect(msg2).toBe('');
  });

  it('should speak again if focus score changes significantly', () => {
    const ctx1 = {
      mood: 'STABLE' as AiMood,
      userName: 'Marcin',
      focusScore: 60,
    };
    engine.generateMessage(ctx1);

    const ctx2 = {
      mood: 'STABLE' as AiMood,
      userName: 'Marcin',
      focusScore: 90,
    }; // Large change -> HIGH_FOCUS
    const msg2 = engine.generateMessage(ctx2);

    expect(msg2).toBe('Ogień z rur! 🔥 Jesteś w totalnym gazie.');
  });

  it('should use the user name in messages', () => {
    // Mock random to pick a template that HAS {{userName}}
    // The first DISTRACTED template has {{userName}}
    const ctx = {
      mood: 'DISTRACTED' as AiMood,
      userName: 'TestUser',
      focusScore: 10,
    };
    const message = engine.generateMessage(ctx);
    expect(message).toContain('TestUser');
    expect(message).toBe(
      'Halo? Ziemia do TestUser... Jesteśmy w pracy czy na wakacjach? 🏖️',
    );
  });

  it('should handle idle state transition', () => {
    const ctx1 = {
      mood: 'STABLE' as AiMood,
      userName: 'Marcin',
      idleTimeMin: 0,
    };
    engine.generateMessage(ctx1);

    const ctx2 = {
      mood: 'STABLE' as AiMood,
      userName: 'Marcin',
      idleTimeMin: 15,
    };
    const msg2 = engine.generateMessage(ctx2);

    expect(msg2).toBe('Zasnąłeś przed monitorem? 💤');
  });
});
