Posts = new Mongo.Collection('posts');

Posts.allow({
	update: function(userId, post) { return ownsDocument(userId, post)},
	remove: function(userId, post) { return ownsDocument(userId, post)}
});

Posts.deny({
	update: function(userId, post, fieldNames) {
		// may only edit the following two fields:
		return (_.without(fieldNames, 'url', 'title').length > 0);
	}
});

Posts.deny({
	update: function(userId, post, fieldNames, modifier) {
		var errors = validatePost(modifier.$set);
		return errors.title || errors.url;
	}
});

Meteor.methods({
	postInsert: function(postAttributes) {
		check(Meteor.userId(), String);
		check(postAttributes, {
			title: String,
			url: String
		});

		var errors = validatePost(postAttributes);
		if (errors.title || errors.url) {
			throw new Meteor.Error('invalid-post', "You must set at title and URL for your post");
		}

		var postWithSameLink = Posts.findOne({url: postAttributes.url});
		if (postWithSameLink) {
			return {
				postExists: true,
				_id: postWithSameLink._id
			}
		}

		var	user = Meteor.user();
		var post = _.extend(postAttributes, {
			userId: user._id,
			author: user.username,
			submitted: new Date(),
			commentsCount: 0,
			upvoters: [],
			votes: 0
		});

		var postId = Posts.insert(post);

		return {
			_id: postId
		};
	},

	upvote: function (postId) {
		if (this.userId === null) {
			Errors.throw("Please login to vote!");
			throw new Meteor.Error('login-to-vote', "Please login to vote!");
		}

		check(this.userId, String);
		check(postId, String);

		// var post = Posts.findOne(postId);
		//
		// if (!post){
		// 	Errors.throw('Post not found');
		// 	throw new Meteor.Error('invalid', 'Post not found');
		// }
		//
		// if (_.include(post.upvoters, this.userId)){
		// 	Errors.throw('Already upvoted this post');
		// 	throw new Meteor.Error('invalid', 'Already upvoted this post');
		// }
		//
		// Posts.update(post._id, {
		// 	$addToSet: {upvoters: this.userId},
		// 	$inc: {votes: 1}
		// });

		var affected = Posts.update({
			_id: postId,
			upvoters: {$ne: this.userId}
		}, {
			$addToSet: {upvoters: this.userId},
			$inc: {votes: 1}
		});

		if (! affected) {
			Errors.throw("You weren't able to upvote that post.")
			throw new Meteor.Error('invalid', "You weren't able to upvote that post.");
		}
	}
});

validatePost = function (post) {
	var errors = {};
	if (!post.title) {
		errors.title = "Please fill in a headline.";
	}
	if (!post.url) {
		errors.url = "Please fill in a URL.";
	}
	return errors;
}
