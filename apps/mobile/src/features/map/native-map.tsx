// Native platforms: the real Apple Maps view. The `.web.tsx` sibling provides a fallback so the
// web preview and the dev bundler never load react-native-maps.
import MapView, { Marker, Polyline } from 'react-native-maps';

export type MapHandle = MapView;
export { MapView, Marker, Polyline };
