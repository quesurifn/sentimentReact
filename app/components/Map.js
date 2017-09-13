import React from 'react'
import styles from '../styles.css'

import { Map, TileLayer, Marker, Icon } from 'react-leaflet';

import icon from '../public/marker-icon.png'
import Leaflet from 'leaflet'




export class MapComponent extends React.Component {
    
   

    render() {

        const image = new Leaflet.Icon({
                iconUrl: icon,
                iconSize:     [20, 20], // size of the icon
                iconAnchor:   [22, 94], // point of the icon which will correspond to marker's location
            })

        const markers = this.props.locations.map((e, index) => (
            <Marker key={index} position={[e.lat, e.lng]} icon={image} />
        ));
        console.log(markers)

        const position = [51.0, -0.09]
        return (
            <div className="marginTopXS box MpH fourEighty"> 
                <p className="subtitle">{this.props.title}</p> 
                <Map center={position} zoom={2}>
                

                    <TileLayer
                        url='http://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'
                        attribution='&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="http://cartodb.com/attributions">CartoDB</a>'
                        subdomains='abcd'
                        maxZoom="19"
                    />

                    {markers}

                </Map>
                <small className="date">As of {this.props.now}</small>
            </div>
        );
    }

}