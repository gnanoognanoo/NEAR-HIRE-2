// Development-only presentation state. This module never imports backend services.
import React, { useState } from "react";
import { Text, View } from "react-native";
import { Button, Choice, styles as s } from "../live/ui";
import { PublishConfirmation } from "../live/JobCreditBalance";
export type ReviewItem = { id: string; title: string; status: string; date: string };
export default function ReviewActivity({
  screen,
  t,
  applications,
  posts,
  setApplications,
  setPosts,
  credits,
  spend,
  go,
}: {
  screen: string;
  t: (k: string) => string;
  applications: ReviewItem[];
  posts: ReviewItem[];
  setApplications: React.Dispatch<React.SetStateAction<ReviewItem[]>>;
  setPosts: React.Dispatch<React.SetStateAction<ReviewItem[]>>;
  credits: number;
  spend: () => void;
  go: (route: string) => void;
}) {
  const [filter, setFilter] = useState("");
  const [repost, setRepost] = useState<ReviewItem | null>(null);
  const [applicant, setApplicant] = useState("pending");
  const isPosts = screen === "posts";
  const rows = isPosts ? posts : applications;
  const transition = (id: string, status: string) =>
    (isPosts ? setPosts : setApplications)((items) =>
      items.map((i) => (i.id === id ? { ...i, status } : i)),
    );
  return (
    <>
      <Text style={s.title}>
        {t(isPosts ? "myPosts" : screen === "applicants" ? "applicants" : "myApplications")}
      </Text>
      {screen === "applicants" ? (
        <View style={s.card}>
          <Text style={s.heading}>{t("bakeryHelper")}</Text>
          <Text style={s.heading}>Ramesh · ★ 4.7</Text>
          <Text style={s.body}>
            {t("electrician")} · {t("experience")}: 2
          </Text>
          <Text style={s.body}>{t(applicant)}</Text>
          <Text style={s.body}>{t("workerPrivacy")}</Text>
          {applicant === "pending" && (
            <>
              <Button
                title={t("accept")}
                onPress={() => {
                  setApplicant("accepted");
                  setPosts((items) =>
                    items.map((i) =>
                      i.title === "bakeryHelper" && i.status === "active"
                        ? { ...i, status: "filled" }
                        : i,
                    ),
                  );
                }}
              />
              <Button title={t("reject")} secondary onPress={() => setApplicant("rejected")} />
            </>
          )}
        </View>
      ) : (
        <>
          <View style={s.row}>
            {[
              "",
              ...(isPosts
                ? ["active", "filled", "in_progress", "completed", "expired", "cancelled"]
                : ["pending", "accepted", "rejected", "withdrawn", "completed"]),
            ].map((k) => (
              <Choice
                key={k}
                title={t(k || "all")}
                selected={filter === k}
                onPress={() => setFilter(k)}
              />
            ))}
          </View>
          {!rows.some((i) => !filter || i.status === filter) && (
            <Text style={s.body}>{t("noActivity")}</Text>
          )}
          {rows
            .filter((i) => !filter || i.status === filter)
            .map((item) => (
              <View key={item.id} style={s.card}>
                <Text style={s.heading}>{t(item.title)}</Text>
                <Text style={s.body}>{t(item.status)}</Text>
                <Text style={s.body}>
                  ₹700 / {t("day")} · {t("annaNagar")}
                </Text>
                <Text style={s.body}>{new Date(item.date).toLocaleDateString()}</Text>
                {isPosts && <Text style={s.body}>{t("workers")}: 1</Text>}
                {isPosts && item.status === "active" && (
                  <>
                    <Text style={s.body}>{t("publicationExpiry")}</Text>
                    <Button title={t("applicants")} onPress={() => go("applicants")} />
                    <Button
                      title={t("cancel")}
                      secondary
                      onPress={() => transition(item.id, "cancelled")}
                    />
                  </>
                )}
                {isPosts && item.status === "filled" && (
                  <Button title={t("start")} onPress={() => transition(item.id, "in_progress")} />
                )}
                {isPosts && item.status === "in_progress" && (
                  <Button title={t("complete")} onPress={() => transition(item.id, "completed")} />
                )}
                {isPosts && item.status === "expired" && (
                  <Button title={t("repost")} onPress={() => setRepost(item)} />
                )}
                {!isPosts && item.status === "pending" && (
                  <Button
                    title={t("withdraw")}
                    secondary
                    onPress={() => transition(item.id, "withdrawn")}
                  />
                )}
                {item.status === "completed" && (
                  <Button title={t("review")} secondary onPress={() => go("reviews")} />
                )}
              </View>
            ))}
          {isPosts && <Button title={t("postAJob")} onPress={() => go("post")} />}
          {repost && (
            <>
              <Text style={s.heading}>{t(repost.title)}</Text>
              <Text style={s.body}>{t("reviewRepost")}</Text>
              <PublishConfirmation
                balance={credits}
                t={t}
                onCancel={() => setRepost(null)}
                onConfirm={() => {
                  if (credits < 1) return;
                  setPosts((items) => [
                    {
                      ...repost,
                      id: `repost-${Date.now()}`,
                      status: "active",
                      date: new Date().toISOString(),
                    },
                    ...items,
                  ]);
                  spend();
                  setRepost(null);
                  setFilter("");
                }}
              />
            </>
          )}
        </>
      )}
    </>
  );
}
