/*
 * Provides generic review capabilities for file attachments.
 */
RB.FileAttachmentReviewable = RB.AbstractReviewable.extend({
    defaults: _.defaults({
        caption: '',
        fileAttachmentID: null,
        diffAgainstFileAttachmentID: null
    }, RB.AbstractReviewable.prototype.defaults),

    defaultCommentBlockFields: [
        'fileAttachmentID',
        'diffAgainstFileAttachmentID'
    ],

    /*
     * Adds comment blocks for the serialized comment block passed to the
     * reviewable.
     */
    loadSerializedCommentBlock: function(serializedCommentBlock) {
        this.createCommentBlock(_.extend({
            fileAttachmentID: this.get('fileAttachmentID'),
            diffAgainstFileAttachmentID:
                this.get('diffAgainstFileAttachmentID'),
            serializedComments: serializedCommentBlock
        }, this.commentBlockModel.prototype.parse(
            _.pick(serializedCommentBlock[0],
                   this.commentBlockModel.prototype.serializedFields))));
    }
});
