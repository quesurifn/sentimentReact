import React from 'react'
import styles from '../styles.css'

import {VictoryBar} from 'victory'


export class SingleBar extends React.Component {
   
    render() {
        return (
            <VictoryBar
                data={this.props.chartData}
                style={{
                    data: {fill: this.props.fillColor, strokeWidth: 50},
                }}
             />
        );
    }

}