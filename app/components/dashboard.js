import React from 'react'
import styles from '../styles.css'

import { Link } from 'react-router'
import { Chart } from 'react-google-charts';


class Dashboard extends React.Component {
    constructor(props) {
        super(props);
        
        this.state = {
            tweet: '',
            overallSentiment: 0,
            lineData:[],
            options: {
                title: 'Senitment Trend',
                vAxis: { minValue: -30, maxValue: 30 },
                titleTextStyle: {
                    color: '#d3d3d3',
                    textPosition: 'none' 
                },
                backgroundColor: '#1a1a1a',
                hAxis: {
                    baselineColor: 'none',
                    textStyle:{color: 'none'},
                    gridlines: {
                        color: 'transparent',
                    }
                },
                vAxis: {
                    textStyle: {color: '#d3d3d3'},
                    gridlines: {
                        count: 5,
                        color: '#333333'
                    }
                },
                legend: 'none'
            },
            
        }
    }
    

    componentDidMount() {
        var connection = new WebSocket('ws://trump-sentiment.herokuapp.com/');
        
        connection.onmessage = (e) => {
            e = JSON.parse(e.data)
            console.log(e)
            if (e.main) {
                let lineArr = this.state.lineData.slice()
                lineArr.push({"date": new Date().getTime(), score: e.main.sentiment.score })
                this.setState({
                    tweet: e.main.featuredTweet,
                    overallSentiment: e.main.sentiment,
                    lineData: lineArr
                    
                })
            }
        }
    }


    render() {
        return (
            <div className="container-fluid">
                <div className="row">
                    <div className="col-md-12 box">
                        <div className="Tweet">
                            {this.state.tweet}
                            <p className="subtitle">Tweets</p> 
                        </div>
                    </div>
                    <div className="col-md-2">
                 
                    </div>
                    <div className="col-md-10">
                    
                    </div>
                </div>
            </div>
        );
    }
}
export default Dashboard