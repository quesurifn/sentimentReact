import React from 'react'
import styles from '../styles.css'

import { Map, TileLayer } from 'react-leaflet';




export class MapComponent extends React.Component {
   

    render() {
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
                </Map>
                <small className="date">As of {this.props.now}</small>
            </div>
        );
    }

}