import {
  createShakeDetector,
  loadAccelerometer,
  resetAccelerometerCache,
  SHAKE_DEBOUNCE_MS,
  SHAKE_WINDOW_MS,
} from '@/features/eggs/shake';

const mockNative = jest.fn();
jest.mock('expo', () => ({
  requireOptionalNativeModule: (name: string) => mockNative(name),
}));

const mockAccelerometer = { addListener: jest.fn(), setUpdateInterval: jest.fn() };
jest.mock('expo-sensors', () => ({ Accelerometer: mockAccelerometer }), { virtual: false });

const REST = { x: 0, y: 0, z: 1 };
const JOLT = { x: 2.1, y: 1.4, z: 0.9 };

describe('createShakeDetector', () => {
  it('fires on a few hard jolts close together', () => {
    const onShake = jest.fn();
    const detect = createShakeDetector(onShake);
    detect(JOLT, 0);
    detect(REST, 100);
    detect(JOLT, 200);
    expect(onShake).not.toHaveBeenCalled();
    detect(JOLT, 400);
    expect(onShake).toHaveBeenCalledTimes(1);
  });

  it('ignores the phone at rest, a walk, and a single bump', () => {
    const onShake = jest.fn();
    const detect = createShakeDetector(onShake);
    for (let t = 0; t < 3000; t += 100) detect(REST, t);
    for (let t = 3000; t < 6000; t += 100) detect({ x: 0.4, y: 0.3, z: 1.2 }, t);
    detect(JOLT, 6000);
    expect(onShake).not.toHaveBeenCalled();
  });

  it('does not add up jolts that are far apart', () => {
    const onShake = jest.fn();
    const detect = createShakeDetector(onShake);
    detect(JOLT, 0);
    detect(JOLT, SHAKE_WINDOW_MS + 100);
    detect(JOLT, 2 * SHAKE_WINDOW_MS + 200);
    expect(onShake).not.toHaveBeenCalled();
  });

  it('debounces: one shake is one shake', () => {
    const onShake = jest.fn();
    const detect = createShakeDetector(onShake);
    for (let t = 0; t <= 1000; t += 100) detect(JOLT, t);
    expect(onShake).toHaveBeenCalledTimes(1);
    const later = 200 + SHAKE_DEBOUNCE_MS + 100;
    for (let t = later; t <= later + 300; t += 100) detect(JOLT, t);
    expect(onShake).toHaveBeenCalledTimes(2);
  });
});

describe('loadAccelerometer', () => {
  beforeEach(() => {
    resetAccelerometerCache();
    mockNative.mockReset();
  });

  it('is null in a binary built before expo-sensors was added, without throwing', () => {
    mockNative.mockReturnValue(null);
    expect(loadAccelerometer()).toBeNull();
    expect(mockNative).toHaveBeenCalledWith('ExponentAccelerometer');
  });

  it('is null when looking for the module throws', () => {
    mockNative.mockImplementation(() => {
      throw new Error('no such module');
    });
    expect(loadAccelerometer()).toBeNull();
  });

  it('is the accelerometer when the native module is there', () => {
    mockNative.mockReturnValue({});
    expect(loadAccelerometer()).toBe(mockAccelerometer);
  });
});
