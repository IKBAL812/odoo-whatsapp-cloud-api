import { ReactionType } from "@/app/context/chats-provider";

export default function MessageReactions({
  reactions,
  isSentFromUser,
}: {
  reactions: ReactionType[];
  isSentFromUser: boolean;
}) {
  return (
    <div
      className={`absolute z-20 -bottom-4 flex gap-1 ${
        isSentFromUser ? "right-3" : "left-3"
      }`}
    >
      {reactions.map((reaction: ReactionType, index: number) => (
        <div
          key={index}
          className="flex justify-center items-center rounded-xl overflow-hidden bg-[rgb(var(--bg-primary))]"
        >
          <p className="text-xs rounded-xl border-[1px] border-[rgb(var(--border-primary)/var(--border-primary-opacity))] bg-[rgb(var(--bg-secondary)/var(--bg-secondary-opacity))] px-1 py-0.5">
            {reaction.emoji}
            {reaction.count > 1 && (
              <span className="ml-0.5">{reaction.count}</span>
            )}
          </p>
        </div>
      ))}
    </div>
  );
}
