import React from 'react'
import styles from '../styles.css'

import { Link } from 'react-router'


import { SingleBar } from './SingleBar'
import { EmojiSentiment } from './emoji'


class Dashboard extends React.Component {
    constructor() {
        super();
        this.neg = 1;
        this.pos = 1;
        this.neu = 1;

        this.state = {
            tweet: '',
            overallSentiment: 0,
            pos: 0,
            neg: 0,
            neu: 0,
            average: 0,
            getBarPos: this.getDataOne(),
            getBarNeg: this.getDataTwo(),
            getBarNeu: this.getDataThree(),
            now: ''
        };
    };
    

    componentDidMount() {
        var connection = new WebSocket('ws://trump-sentiment.herokuapp.com/');
        
        connection.onmessage = (e) => {
            e = JSON.parse(e.data)
            console.log(e)
            if (e.main) {
                this.pos = e.main.pos;
                this.neg = e.main.neg;
                this.neu = e.main.neu;

                this.setState({
                    tweet: e.main.featuredTweet,
                    overallSentiment: e.main.sentiment.score,
                    pos: e.main.pos,
                    neg: e.main.neg,
                    neu: e.main.neu,
                    average: e.main.average,
                    getBarPos: this.getDataOne(),
                    getBarNeg: this.getDataTwo(),
                    getBarNeu: this.getDataThree(),
                    now: new Date().toLocaleDateString()
                })
                
            }
        }
    }

    getDataOne() {
        return [ 
            {x: 1, y: this.neg }
        ]  
    }
    getDataTwo() {
        return [ 
            {x: 1, y: this.pos }
        ] 
    }
    getDataThree() {
        return [ 
            {x: 1, y: this.neu }
        ] 
    }


    render() {
        const singleFillColor = '#327FC5';

        return (
            <div className="container-fluid">
                <div className="row">
                    <div className="col-md-12 box">
                        <div className="Tweet">
                            {this.state.tweet}
                            <p className="subtitleTop">Tweets</p> 
                            <small className="date">{this.state.now}</small>
                        </div>
                    </div>
                    <div className="col-md-2 marginR">
                        <div className="marginTopSM box">
                            <SingleBar data={this.state.getBarPos } fillColor={"RoyalBlue"} />  
                            <p className="subtitle">Positive Tweets</p> 
                            <p className="tweetCounter">{this.state.pos}</p>
                            <small className="date">{this.state.now}</small>
                        </div>
                    </div>
                    <div className="col-md-2 marginR">
                        <div className="marginTopSM box">
                            <SingleBar data={ this.state.getBarNeg  } fillColor={"Tomato"} />  
                            <p className="subtitle">Negative Tweets</p> 
                            <p className="tweetCounter">{this.state.neg}</p>
                            <small className="date">{this.state.now}</small>
                        </div>
                    </div>
                    <div className="col-md-2 marginR">
                        <div className="marginTopSM box">
                            <SingleBar data={ this.state.getBarNeu } fillColor={"Orange"} />  
                            <p className="subtitle">Neutral Tweets</p> 
                            <p className="tweetCounter">{this.state.neu}</p>
                            <small className="date">{this.state.now}</small>
                        </div>
                    </div>
                    <div className="col-md-2">
                        <div className="marginTopXS flexStacked">
                            <div className="fixedH box marginTop15">
                                <span className="bigNum">{this.state.average}</span>
                                <p className="subtitleTop">Score</p> 
                                <small className="date">{this.state.now}</small>
                            </div>
                            <div className="fixedH box">
                                <EmojiSentiment className="bigNum" score={this.state.average} />
                                <p className="subtitleTop">Overall Sentiment</p>
                                <small className="date">{this.state.now}</small>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}


export default Dashboard