import React from 'react'
import styles from '../styles.css'

import { Link } from 'react-router'


class Dashboard extends React.Component {
    constructor(props) {
        super(props);
        
        this.state = {
            tweet: '',
            overallSentiment: 0
        }
    }
    

    componentWillMount() {
        var connection = new WebSocket('ws://trump-sentiment.herokuapp.com/');
        
        connection.onopen = function () {
            connection.send('Ping');
        };
        connection.onmessage = function (e) {
            console.log(e)
            if (e.data.main) {
                this.state.tweet = e.data.main.featuredTweet
                this.state.overallSentiment = e.data.main.sentiment
            }
        };
    }


    render() {
        return (
            <div>
              <div className="Tweet">{this.state.tweet}</div>
            </div>
        );
    }
}
export default Dashboard