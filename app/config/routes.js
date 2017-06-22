import React from 'react'
import { Router, Route, Switch, browserHistory, IndexRoute } from 'react-router';

import Home from '../components/home.js'
import Dashboard from '../components/dashboard.js'
import Main from '../components/main.js'

const routes = ( 
    <Router history={browserHistory}>
        <Route path="/" component={Main} >
            <IndexRoute component={Home} />
            <Route path="/dashboard" component={Dashboard} />
        </Route>
    </Router>
);

export default routes