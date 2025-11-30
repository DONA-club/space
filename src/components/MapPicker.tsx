"use client";

import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Search, MapPin, Crosshair } from 'lucide-react';

// Fix for default marker icons in Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface MapPickerProps {
  initialLat?: number;
  initialLng?: number;
  onLocationSelect: (lat: number, lng: number) => void;
}

function MapController({ center }: { center: [number, number] }) {
  const map = useMap();
  
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  
  return null;
}

function LocationMarker({ position, onPositionChange }: { 
  position: [number, number]; 
  onPositionChange: (lat: number, lng: number) => void;
}) {
  const markerRef = useRef<L.Marker>(null);

  useMapEvents({
    click(e) {
      onPositionChange(e.latlng.lat, e.latlng.lng);
    },
  });

  useEffect(() => {
    const marker = markerRef.current;
    if (marker) {
      marker.setLatLng(position);
      
      if (marker.dragging) {
        marker.dragging.enable();
      }
      
      const handleDragEnd = () => {
        const pos = marker.getLatLng();
        onPositionChange(pos.lat, pos.lng);
      };
      
      marker.on('dragend', handleDragEnd);
      
      return () => {
        marker.off('dragend', handleDragEnd);
      };
    }
  }, [position, onPositionChange]);

  return (
    <Marker
      ref={markerRef}
      position={position}
    />
  );
}

export const MapPicker = ({ initialLat = 48.8566, initialLng = 2.3522, onLocationSelect }: MapPickerProps) => {
  const [position, setPosition] = useState<[number, number]>([initialLat, initialLng]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);

  const handlePositionChange = (lat: number, lng: number) => {
    setPosition([lat, lng]);
    onLocationSelect(lat, lng);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`
      );
      const data = await response.json();

      if (data && data.length > 0) {
        const { lat, lon } = data[0];
        const newPosition: [number, number] = [parseFloat(lat), parseFloat(lon)];
        setPosition(newPosition);
        onLocationSelect(newPosition[0], newPosition[1]);
      }
    } catch (error) {
      console.error('Geocoding error:', error);
    } finally {
      setSearching(false);
    }
  };

  const handleGetCurrentLocation = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newPosition: [number, number] = [
            position.coords.latitude,
            position.coords.longitude
          ];
          setPosition(newPosition);
          onLocationSelect(newPosition[0], newPosition[1]);
        },
        (error) => {
          console.error('Geolocation error:', error);
        }
      );
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="flex-1">
          <Label htmlFor="search-location" className="sr-only">Rechercher une adresse</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              id="search-location"
              type="text"
              placeholder="Rechercher une adresse..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSearch();
                }
              }}
              className="pl-10"
            />
          </div>
        </div>
        <Button
          type="button"
          onClick={handleSearch}
          disabled={searching || !searchQuery.trim()}
          variant="outline"
        >
          {searching ? 'Recherche...' : 'Rechercher'}
        </Button>
        <Button
          type="button"
          onClick={handleGetCurrentLocation}
          variant="outline"
          size="icon"
          title="Ma position actuelle"
        >
          <Crosshair size={16} />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-xs text-gray-600 dark:text-gray-400">Latitude</Label>
          <Input
            type="number"
            step="any"
            value={position[0].toFixed(6)}
            onChange={(e) => {
              const lat = parseFloat(e.target.value);
              if (!isNaN(lat)) {
                handlePositionChange(lat, position[1]);
              }
            }}
            className="text-sm"
          />
        </div>
        <div>
          <Label className="text-xs text-gray-600 dark:text-gray-400">Longitude</Label>
          <Input
            type="number"
            step="any"
            value={position[1].toFixed(6)}
            onChange={(e) => {
              const lng = parseFloat(e.target.value);
              if (!isNaN(lng)) {
                handlePositionChange(position[0], lng);
              }
            }}
            className="text-sm"
          />
        </div>
      </div>

      <div className="relative h-96 rounded-lg overflow-hidden border border-gray-300 dark:border-gray-700">
        <MapContainer
          {...{ center: position } as any}
          zoom={13}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={true}
        >
          <TileLayer
            {...{ attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' } as any}
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapController center={position} />
          <LocationMarker position={position} onPositionChange={handlePositionChange} />
        </MapContainer>
      </div>

      <div className="text-xs text-gray-600 dark:text-gray-400 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
        <div className="flex items-start gap-2">
          <MapPin size={14} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-medium mb-1">Comment placer le marqueur :</p>
            <ul className="space-y-1 text-xs">
              <li>• Cliquez sur la carte pour placer le marqueur</li>
              <li>• Glissez-déposez le marqueur pour le déplacer</li>
              <li>• Recherchez une adresse dans la barre de recherche</li>
              <li>• Utilisez votre position actuelle avec le bouton GPS</li>
              <li>• Modifiez manuellement les coordonnées</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};