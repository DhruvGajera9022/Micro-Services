const logger = require("../utils/logger");
const Search = require("../model/Search");


const handlePostCreated = async (event) => {
    try {
        const newSearchPost = new Search({
            postId: event.postId,
            userId: event.userId,
            content: event.content,
            createdAt: event.createdAt
        });

        await newSearchPost.save();
        logger.info(`Search post created: ${event.postId}, ${newSearchPost._id.toString()}`);
    } catch (error) {
        logger.error("Error handling post creating event", error);
    }
}


const handlePostDeleted = async (event) => {
    try {
        await Search.findOneAndDelete({ postId: event.postId });
        logger.info(`Search post deleted: ${event.postId}`);
    } catch (error) {
        logger.error("Error handling post deleting event", error);
    }
}


module.exports = { handlePostCreated, handlePostDeleted }