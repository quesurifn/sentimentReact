import React from 'react'
import styles from '../styles.css'


import { Link } from 'react-router'


import { SingleBar } from './SingleBar'
import { MapComponent } from './Map'
import { EmojiSentiment } from './emoji'
import { VictoryLine} from 'victory'
import { VictoryPie } from 'victory-pie'







export default class Dashboard extends React.Component {

    constructor() {
        super();
        this.neg = 1;
        this.pos = 1;
        this.neu = 1;
        this.total = 0;
        this.neuPercent = 0;
        this.negPercent = 0;
        this.posPercent = 0;

        this.counter = 0;

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
            now: '',
            sentArr: [],
            percentage:[],
            posLoc: [],
            negLoc: [],
            neuLoc: []
        };
    };
    


    componentDidMount() {
        
        var connection = new WebSocket('ws://trump-sentiment.herokuapp.com/');
        
        connection.onmessage = (e) => {



            var one,two,three;
            this.state.percentage.length = 0;
            var total = this.neg + this.pos + this.neu;

            var negPercent = parseFloat( ((this.neg / total) * 100).toFixed(2) )

            var posPercent = parseFloat( ((this.pos / total) * 100).toFixed(2) )

            var neuPercent = parseFloat ( ((this.neu / total) * 100).toFixed(2) ) 


        

            var one = [{x: "Negative", y: negPercent}]
            var two = [{x: "Positive", y: posPercent}]
            var three = [{x: "Neutral", y: neuPercent}]

            var concatedPercent = one.concat(two, three)
            

            e = JSON.parse(e.data)
            console.log(e)
            if (e.main) {
                this.counter++
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
                    now: new Date().toLocaleString(),
                    sentArr: this.state.sentArr.concat({y: e.main.average, x: new Date().toLocaleTimeString(), i: this.counter }),
                    percentage: this.state.percentage.concat(concatedPercent)
                })
               console.log(this.state.sentArr)
            } else {
                const that = this;
                e.location.forEach(function(elem) {
                  
                    const latlng = elem.location
               
                    if(elem.sentiment.score > 0) {
                        that.state.posLoc.push(latlng)
                        console.log('pos fired')
                    } else if (elem.sentiment.score < 0) {
                        that.state.negLoc.push(latlng)
                        console.log('neg fired')
                    } else if (elem.sentiment.score === 0) {
                        that.state.neuLoc.push(latlng) 
                        console.log('neutral fired')
                    }
                })

                console.log(that.state.posLoc)
               
            } // else 
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
                            <small className="date">As of {this.state.now}</small>
                        </div>
                    </div>
                    <div className="col-md-2 marginR">
                        <div className="marginTopSM box">
                            <SingleBar data={this.state.getBarPos } fillColor={"RoyalBlue"} />  
                            <p className="subtitle">Positive Tweets</p> 
                            <p className="tweetCounter">{this.state.pos}</p>
                            <small className="date">As of {this.state.now}</small>
                        </div>
                    </div>
                    <div className="col-md-2 marginR">
                        <div className="marginTopSM box">
                            <SingleBar data={ this.state.getBarNeg  } fillColor={"Tomato"} />  
                            <p className="subtitle">Negative Tweets</p> 
                            <p className="tweetCounter">{this.state.neg}</p>
                            <small className="date">As of {this.state.now}</small>
                        </div>
                    </div>
                    <div className="col-md-2 marginR">
                        <div className="marginTopSM box">
                            <SingleBar data={ this.state.getBarNeu } fillColor={"Orange"} />  
                            <p className="subtitle">Neutral Tweets</p> 
                            <p className="tweetCounter">{this.state.neu}</p>
                            <small className="date">As of {this.state.now}</small>
                        </div>
                    </div>
                    <div className="col-md-2 marginR">
                        <div className="marginTopXS flexStacked">
                            <div className="fixedH box marginTop15">
                                <span className="bigNum">{this.state.average}</span>
                                <p className="subtitleTop">Score</p> 
                                <small className="date">As of {this.state.now}</small>
                            </div>
                            <div className="fixedH box">
                                <EmojiSentiment className="bigNum" score={this.state.average} />
                                <p className="subtitleTop">Overall Sentiment</p>
                                <small className="date">As of {this.state.now}</small>
                            </div>
                        </div>
                    </div>
                    <div className="col-md-3 Percent29">
                        <div className="marginTopXS box SpH">
                          <p className="subtitle">Sentiment Trend</p> 
                          <VictoryLine
                        data={this.state.sentArr}
                        domain={{ y: [-2, 2] }}
                        style={{ data: {strokeWidth: 3, stroke: "RoyalBlue"}, tickLabels: {stroke: "gray"}, labels: {stroke: "LightGray"}    }}
                        labels={(d) => d.i % 20 === 0 || d.i === 1 ? d.label = d.x + "S: " + d.y : ""}
                        width={800}
                        height={300}
                        />
                        <small className="date">As of {this.state.now}</small>
                        </div>
                    </div>
                </div>
                <div className="row">
                    <div className="col-md-4 marginR">
                        <div className="marginTopXS box MpH">
                            <p className="subtitle">Percentage of Tweets</p> 
                            <VictoryPie 
                                data={this.state.percentage}

                                innerRadius={100}
                                colorScale={["tomato", "RoyalBlue", "Orange" ]}
                                style={{tickLabels: {stroke: "#303030"}, labels:{stroke: "#303030"}}}
                            />
                                <div className="inlineLegened">
                                    <div className="legenedBoxPos">
                                    </div>
                                    <span className="legenedSpan">Positive</span>
                                    <div className="legenedBoxNeg">
                                    </div>
                                    <span className="legenedSpan">Negative</span>
                                    <div className="legenedBoxNeu">
                                    </div>
                                    <span className="legenedSpan">Neutral</span>
                                    </div>
                        
                        </div>
                        <small className="date">As of {this.state.now}</small>
                    </div> 
            
                <div className="col-md-2 i-2 marginR">
                    <MapComponent now={this.state.now} title={"Postive Locations"} locations={this.state.posLoc} /> 
                </div>

                <div className="col-md-2 i-2 marginR">
                    <MapComponent now={this.state.now} title={"Negative Locations"} locations={this.state.neuLoc} /> 
                </div>

                <div className="col-md-2 i-2">
                    <MapComponent now={this.state.now} title={"Neutral Locations"} locations={this.state.negLoc} /> 
                </div>

               

            </div>
        
        </div>
        );
    }
}

