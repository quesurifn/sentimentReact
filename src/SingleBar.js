import React from 'react'


import {VictoryBar , VictoryChart} from 'victory'


export class SingleBar extends React.Component {
   
    render() {
        return (
            <VictoryBar
                data={this.props.data}
                domain={{ x: [1, 1], y: [0, 30] }}
                style={{
                    data: {fill: this.props.fillColor, strokeWidth: 80},
                }}
             />

        );
    }

}