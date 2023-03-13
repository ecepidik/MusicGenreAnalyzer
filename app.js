/**
 * This is an example of a basic node.js script that performs
 * the Authorization Code oAuth2 flow to authenticate against
 * the Spotify Accounts.
 *
 * For more information, read
 * https://developer.spotify.com/web-api/authorization-guide/#authorization_code_flow
 */

var express = require('express'); // Express web server framework
var request = require('request'); // "Request" library
var cors = require('cors');
var querystring = require('querystring');
var cookieParser = require('cookie-parser');

var client_id = 'f0ddbe86a6214afe8918be2c7f0adc5f'; // Your client id
var client_secret = '7fe655d924a242a9bad4d9c4ffc0ec4b'; // Your secret
var redirect_uri = 'http://localhost:8000/callback/'; // Your redirect uri

var client_id_lastfm = '58a640320f7da03e6f25d66d9de7123d'; // Your client id
var client_secret_lastfm = '517d7a6ae6a2f33926480b90e5b242a6'; // Your secret
var redirect_uri_lastfm = 'http://localhost:8000/callback/'; // Your redirect uri

/**
 * Generates a random string containing numbers and letters
 * @param  {number} length The length of the string
 * @return {string} The generated string
 */
var generateRandomString = function(length) {
  var text = '';
  var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  for (var i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

var stateKey = 'spotify_auth_state';

var app = express();

app.use(express.static(__dirname + '/public'))
   .use(cors())
   .use(cookieParser());

app.get('/login', function(req, res) {

  var state = generateRandomString(16);
  res.cookie(stateKey, state);

  // your application requests authorization
  var scope = 'user-read-private user-read-email user-follow-read user-top-read';
  res.redirect('https://accounts.spotify.com/authorize?' +
    querystring.stringify({
      response_type: 'code',
      client_id: client_id,
      scope: scope,
      redirect_uri: redirect_uri,
      state: state
    }));
});

app.get('/callback', function(req, res) {

  // your application requests refresh and access tokens
  // after checking the state parameter

  var code = req.query.code || null;
  var state = req.query.state || null;
  var storedState = req.cookies ? req.cookies[stateKey] : null;

  if (state === null || state !== storedState) {
    res.redirect('/#' +
      querystring.stringify({
        error: 'state_mismatch'
      }));
  } else {
    res.clearCookie(stateKey);
    var authOptions = {
      url: 'https://accounts.spotify.com/api/token',
      form: {
        code: code,
        redirect_uri: redirect_uri,
        grant_type: 'authorization_code'
      },
      headers: {
        'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64'))
      },
      json: true
    };

    request.post(authOptions, function(error, response, body) {
      if (!error && response.statusCode === 200) {

        var access_token = body.access_token,
            refresh_token = body.refresh_token;

        var options = {
          url: 'https://api.spotify.com/v1/me',
          headers: { 'Authorization': 'Bearer ' + access_token },
          json: true
        };

        // use the access token to access the Spotify Web API
        request.get(options, function(error, response, body) {
          console.log(body);
        });

        // we can also pass the token to the browser to make requests from there
        res.redirect('/#' +
          querystring.stringify({
            access_token: access_token,
            refresh_token: refresh_token
          }));
      } else {
        res.redirect('/#' +
          querystring.stringify({
            error: 'invalid_token'
          }));
      }
    });
  }
});

app.get('/refresh_token', function(req, res) {

  // requesting access token from refresh token
  var refresh_token = req.query.refresh_token;
  var authOptions = {
    url: 'https://accounts.spotify.com/api/token',
    headers: { 'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64')) },
    form: {
      grant_type: 'refresh_token',
      refresh_token: refresh_token
    },
    json: true
  };

  request.post(authOptions, function(error, response, body) {
    if (!error && response.statusCode === 200) {
      var access_token = body.access_token;
      res.send({
        'access_token': access_token
      });
    }
  });
});

app.use(express.json());
app.post('/user-top-ten', function(req, res) {

  var access_token = req.body.access_token

  retrieve_user_top_track(access_token, function(track_data) {
    console.log(track_data[0].name + ": " + track_data[0].artists[0].name);
    retrieve_track_genres(track_data[0].name, track_data[0].artists[0].name, function(genres) {
      res.send(genres);
    })
  })
})

function retrieve_user_top_track(access_token, callback) {
  var options = {
    url: 'https://api.spotify.com/v1/me/top/tracks?limit=1',
    headers: { 'Authorization': 'Bearer ' + access_token},
    json: true
  };

  request.get(options, function(error, response) {
    console.log(response.body)
    if (!error && response.statusCode === 200) {
      var body = response.body;
      console.log(body.items);
      return callback(body.items)
    //   res.send({
    //     'body': body
    //   });
    // }
    // else {
    //   res.sendStatus(response.statusCode)
    }
  });
}

function retrieve_track_genres(track, artist, callback) {
  var url = 'http://ws.audioscrobbler.com/2.0/?method=track.getTopTags&api_key=' + client_id_lastfm +'&'
  + querystring.stringify({
    artist: artist.toLowerCase(),
    track: track.toLowerCase(),
    format: 'json'});
    console.log(url);
    
  var options = {
    url: url ,
    json: true
  }

  var genres = [];
  return request.get(options, function(error, response) {
    if(!error && response.statusCode === 200) {
      var track_data = response.body;
      genres = track_data.toptags.tag.map(genre => {
        return genre.name
      })
      return callback(genres)
    }
  })
  // return genres;
}

app.post('/get-genre', function(req, res) {
  var track = req.body.track;
  var artist = req.body.artist;
  retrieve_track_genres(track, artist, function(data){    
    res.send(data); 
  }); 
})

app.post('/get-artist-genre', function(req, res) {
  var artist = req.body.artist;
  var options = {
    url: `http://ws.audioscrobbler.com/2.0/?method=artist.getTopTags&api_key=${client_id_lastfm}&`
    + querystring.stringify({
      artist: artist,
      format: 'json'
    }),
    json: true
  };

  request.get(options, function(error, response) {
    if (response.statusCode === 200){
      console.log('Retrieved response from last fm');
      res.send(response.body);
    }
    else {
      res.send(error);
    }
  })
})


console.log('Listening on 8000');
app.listen(8000);
