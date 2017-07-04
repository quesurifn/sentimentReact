import React from 'react'
import styles from '../styles.css'

import { Link } from 'react-router'


import { SingleBar } from './SingleBar'
import { EmojiSentiment } from './emoji'


class Dashboard extends React.Component {
    constructor(props) {
        super(props);
        
        this.state = {
            tweet: '',
            overallSentiment: 0,
            pos: 0,
            neg: 0,
            neu: 0,
            average: 0
        }
    }
    

    componentDidMount() {
        var connection = new WebSocket('ws://trump-sentiment.herokuapp.com/');
        
        connection.onmessage = (e) => {
            e = JSON.parse(e.data)
            console.log(e)
            if (e.main) {
                this.setState({
                    tweet: e.main.featuredTweet,
                    overallSentiment: e.main.sentiment.score,
                    pos: e.main.pos,
                    neg: e.main.neg,
                    neu: e.main.neu,
                    average: e.main.average
                })
            }
        }
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
                        </div>
                    </div>
                    <div className="col-md-2 marginR">
                        <div className="marginTopSM box">
                            <SingleBar data={this.state.pos} fillColor={"RoyalBlue"} />  
                            <p className="subtitle">Positive Tweets</p> 
                        </div>
                    </div>
                    <div className="col-md-2 marginR">
                        <div className="marginTopSM box">
                            <SingleBar data={this.state.neg} fillColor={"Tomato"} />  
                            <p className="subtitle">Negative Tweets</p> 
                        </div>
                    </div>
                    <div className="col-md-2 marginR">
                        <div className="marginTopSM box">
                            <SingleBar data={this.state.neu} fillColor={"Orange"} />  
                            <p className="subtitle">Neutral Tweets</p> 
                        </div>
                    </div>
                    <div className="col-md-2">
                        <div className="marginTopXS flexStacked">
                            <div className="fixedH box marginTop15">
                                <span className="bigNum">{this.state.average}</span>
                                <p className="subtitleTop">Score</p> 
                            </div>
                            <div className="fixedH box">
                                <EmojiSentiment className="bigNum" score={this.state.average} />
                                <p className="subtitleTop">Overall Sentiment</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}


export default Dashboard