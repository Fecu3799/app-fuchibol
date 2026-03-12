-- CreateTable: ConversationReadState — tracks last-read timestamp per user per conversation.
-- Used to compute hasUnread in conversation lists and to skip push when user is actively viewing.
CREATE TABLE "ConversationReadState" (
    "userId"         UUID        NOT NULL,
    "conversationId" UUID        NOT NULL,
    "lastReadAt"     TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "ConversationReadState_pkey" PRIMARY KEY ("userId", "conversationId")
);

-- FK → User
ALTER TABLE "ConversationReadState"
    ADD CONSTRAINT "ConversationReadState_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- FK → Conversation
ALTER TABLE "ConversationReadState"
    ADD CONSTRAINT "ConversationReadState_conversationId_fkey"
    FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Index for fetching all read states for a given conversation (fanout, push suppression)
CREATE INDEX "ConversationReadState_conversationId_idx" ON "ConversationReadState"("conversationId");
