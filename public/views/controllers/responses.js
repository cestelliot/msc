//https://www.terlici.com/2015/04/03/mongodb-node-express.html

const express = require('express'),
    router = express.Router(),
    mongoose = require( 'mongoose'),
    Response = require('./../models/response');

exports.save = function (data) {
  var stage = 'Saving trial data in db...';
  return new Promise((resolve, reject) => {
    console.log(data.trialId, stage);

    Response.create(data, (err, result) => {
      if (err){
        err.trialId = data.trialId;
        reject(err);
      } else {
        console.log(data.trialId, 'Data saved!');
        resolve(data);
      }
    });
  });
};
