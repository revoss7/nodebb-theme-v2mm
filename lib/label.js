// Generated by CoffeeScript 1.10.0
"use strict";
var Posts, Privileges, S, SocketPlugins, Topics, User, _, async, db, meta, notifications, utils, winston;

async = require('async');

meta = require.main.require('./src/meta');

db = require.main.require('./src/database');

winston = require('winston');

SocketPlugins = require.main.require('./src/socket.io/plugins');

User = require.main.require('./src/user');

Topics = require.main.require('./src/topics');

Privileges = require.main.require('./src/privileges');

Posts = require.main.require('./src/posts');

notifications = require.main.require('./src/notifications');

S = require('string');

utils = require.main.require('./public/src/utils');

_ = require('underscore');

(function(TopicLabel) {
  TopicLabel.canCreate = function(cid, uid, callback) {
    return Privileges.categories.can('label:create', cid, uid, function(err, can) {
      if (err || !can) {
        return callback(new Error('[[v2mm:error.privilege.label.create]]'), can);
      } else {
        return callback(null, can);
      }
    });
  };
  TopicLabel.create = function(name, data, uid, callback) {
    var cleanName, hash, isMember;
    if (!name || name.length < (meta.config.minimumLabelLength || 2)) {
      return setImmediate(callback, new Error('[[v2mm:invalid-label-name]]'));
    }
    cleanName = utils.cleanUpTag(name, meta.config.maximumLabelLength || 255);
    hash = {
      value: name,
      name: cleanName
    };
    hash.color = data.color;
    hash.bkColor = data.bkColor;
    isMember = false;
    return async.waterfall([
      function(next) {
        return db.isSortedSetMember('labels:topic:count', cleanName, next);
      }, function(_isMember, next) {
        isMember = _isMember;
        if (!isMember) {
          hash.createtime = Date.now();
          hash.createby = uid;
        }
        return db.setObject('label:' + cleanName, hash, next);
      }, function(next) {
        if (isMember) {
          return next();
        }
        return db.sortedSetAdd('labels:topic:count', 0, cleanName, next);
      }
    ], callback);
  };
  TopicLabel.remove = function(data, callback) {
    if (!((data != null ? data.name : void 0) && data.value)) {
      return setImmediate(callback, new Error('[[v2mm:invalid-label-name]]'));
    }
    return async.waterfall([
      function(next) {
        return db.getSetMembers('label:' + data.name + ':topics', next);
      }, function(tids, next) {
        var _fn;
        _fn = function(tid, _cb) {
          return db.setRemove('topic:' + tid + ':labels', data.name, _cb);
        };
        return async.each(tids, _fn, next);
      }, function(next) {
        return db.sortedSetRemove('labels:topic:count', data.name, next);
      }, function(next) {
        return db["delete"]('label:' + data.name + ':topics', next);
      }, function(next) {
        return db["delete"]('label:' + data.name, next);
      }
    ], callback);
  };
  TopicLabel.addToTopic = function(tid, data, callback) {
    if (!((data != null ? data.name : void 0) && data.value)) {
      return callback(new Error('[[v2mm:error.invalid-label-name]]'));
    }
    return async.parallel([
      function(next) {
        return db.setAdd('label:' + data.name + ':topics', tid, next);
      }, function(next) {
        return db.setAdd('topic:' + tid + ':labels', data.name, next);
      }
    ], function(err, ret) {
      if (err) {
        return callback(err);
      }
      return TopicLabel.updateLabelsTopicCount(data.name, callback);
    });
  };
  TopicLabel.removeFromTopic = function(tid, data, callback) {
    if (!((data != null ? data.name : void 0) && data.value)) {
      return callback(new Error('[[v2mm:error.invalid-label-name]]'));
    }
    return async.parallel([
      function(next) {
        return db.setRemove('label:' + data.name + ':topics', tid, next);
      }, function(next) {
        return db.setRemove('topic:' + tid + ':labels', data.name, next);
      }
    ], function(err, ret) {
      if (err) {
        return callback(err);
      }
      return TopicLabel.updateLabelsTopicCount(data.name, callback);
    });
  };
  TopicLabel.removeTopicLabels = function(tid, callback) {
    var labels;
    labels = [];
    return async.waterfall([
      function(next) {
        return db.getSetMembers('topic:' + tid + ':labels', next);
      }, function(_labels, next) {
        var sets;
        labels = _labels;
        sets = labels.map(function(lb) {
          return 'label:' + lb + ':topics';
        });
        return db.setsRemove(sets, tid, next);
      }, function(next) {
        return async.each(labels, TopicLabel.updateLabelsTopicCount, next);
      }, function(next) {
        return db["delete"]('topic:' + tid + ':labels', next);
      }
    ], callback);
  };
  TopicLabel.updateLabelsTopicCount = function(label, callback) {
    return async.waterfall([
      function(next) {
        return db.setCount('label:' + label + ':topics', next);
      }, function(count, next) {
        return db.sortedSetAdd('labels:topic:count', count, label, next);
      }
    ], callback);
  };
  TopicLabel.getTopicsLabels = function(tids, callback) {
    var sets, topicsLabels, uniqueTopicsLabels;
    sets = tids.map(function(tid) {
      return 'topic:' + tid + ':labels';
    });
    topicsLabels = uniqueTopicsLabels = null;
    return async.waterfall([
      function(next) {
        return db.getSetsMembers(sets, next);
      }, function(_topicsLabels, next) {
        var keys;
        topicsLabels = _topicsLabels;
        uniqueTopicsLabels = _.uniq(_.flatten(topicsLabels));
        keys = uniqueTopicsLabels.map(function(label) {
          return 'label:' + label;
        });
        return db.getObjects(keys, next);
      }
    ], function(err, labelsData) {
      if (err) {
        return callback(err);
      }
      labelsData = _.object(uniqueTopicsLabels, labelsData);
      topicsLabels.forEach(function(labels, index) {
        if (Array.isArray(labels)) {
          return topicsLabels[index] = labels.map(function(label) {
            return labelsData[label];
          });
        }
      });
      return callback(null, topicsLabels);
    });
  };
  return TopicLabel.getAvailabelLabels = function(callback) {
    return async.waterfall([
      function(next) {
        return db.getSortedSetRevRange('labels:topic:count', 0, -1, next);
      }, function(labels, next) {
        var keys;
        keys = labels.map(function(label) {
          return 'label:' + label;
        });
        return db.getObjects(keys, next);
      }
    ], callback);
  };
})(exports);