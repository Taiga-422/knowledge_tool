
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, serverTimestamp, orderBy, query, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js"

// Firebaseの設定
const firebaseConfig = {

};

// Firebase初期化
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 以下は、$(document).readyの省略形。jQueryの書き方。
$(function () {
    // 入力フォームの表示/非表示
    $("#post-button").on("click", function () {
        $("#input").fadeIn(200);
        console.log("開いた！")
    });

    $("#reset").on("click", function () {
        $("#input").fadeOut(100);
        console.log("閉じた！")
    });

    // タグ入力
    $("#tag-input").on("keypress", function (e) {
        if (e.key === "Enter") {   //Enterキーを押した問だけにする。
            e.preventDefault();  //入力が送信されたりする動作を防ぐ。
            const tagText = $(this).val().trim();  //(this)は、#tag-inputを指す。
            if (tagText) {
                const tag = $(`<div class="tag">${tagText}</div>`);
                $("#tag").append(tag);
                $(this).val("");
            }
        }
    });

    // タグ削除  ".tag"は、JSによって追加される要素だから、$(document).onを使わないと操作できない。
    $(document).on("click", ".tag", function () { $(this).remove(); });

    // 質問の情報を保存
    $("#save").on("click", async function () {
        const tags = [];
        $("#tag").children().each(function () {
            tags.push($(this).text());
        });

        const ask = $("#ask").val();
        const detail = $("#detail").val();
        const file = $("#input-file").val();

        if (!ask || !detail) {
            alert("質問と詳細を入力してください");
            return;
        }

        const msg = {
            ask: ask,
            detail: detail,
            tags: tags,
            file: file,
        };

        try {
            const docRef = await addDoc(collection(db, "questions"), msg);

            console.log("ドキュメントが保存された！", docRef.id);

            // カード作成
            let tagHtml = tags.map(tag => `<div class="tag">${tag}</div>`).join("");
            let card = `
                    <div class="card" data-id="${docRef.id}">
                        <h3>${msg.ask}</h3>
                        <p>${msg.detail}</p>
                        <div>${tagHtml}</div>
                        <div class="chat-area">
                            <div class="chat-messages"></div>
                            <form class="chat-form">
                                <input type="text" placeholder="メッセージを入力..." class="chat-input">
                                <button type="submit">送信</button>
                            </form>
                        </div>
                        <button class="delete-button">削除</button>
                    </div>
                `;
            $("#save-area").append(card);

            // フォームをリセット
            $("#ask, #detail, #tag-input, #input-file").val("");
            $("#tag").empty();
            $("#input").fadeOut(100);
        } catch (error) {
            console.error("保存に失敗", error);
        };
    });

    // カードクリックでチャットエリアを表示
    $(document).on("click", ".card", async function () {
        const chatArea = $(this).find(".chat-area");
        const chatMessages = chatArea.find(".chat-messages");
        const questionId = $(this).data("id");

        chatArea.slideToggle();

        // チャットデータの取得と表示
        if (chatArea.is(":visible")) {
            try {
                const messagesCollection = collection(db, "questions", questionId, "messages");
                const q = query(messagesCollection, orderBy("timestamp", "asc"));
                const querySnapshot = await getDocs(q);

                // 既存のメッセージをクリアして新しいメッセージを追加
                chatMessages.empty();
                querySnapshot.forEach((doc) => {
                    const data = doc.data();
                    const timestamp = data.timestamp ? data.timestamp.toDate().toLocaleString() : "不明";
                    chatMessages.append(`<div>${data.user}: ${data.text} <small>${timestamp}</small></div>`);
                });

                console.log(`チャットメッセージが読み込まれました: ${questionId}`);
            } catch (error) {
                console.error("チャットデータの取得に失敗", error);
            }
        }
    });

    // チャットエリア内クリック時にチャットエリアが閉じるのを防ぐ
    $(document).on("click", ".chat-area", function (e) {
        e.stopPropagation(); // クリックイベントがカードに伝播しないようにする
    });

    // チャットメッセージを送信する
    $(document).on("submit", ".chat-form", async function (e) {
        e.preventDefault();
        const form = $(this);
        const input = form.find(".chat-input");
        const message = input.val().trim();
        const card = form.closest(".card");
        const questionId = card.data("id");

        if (message) {
            const chatMessages = form.siblings(".chat-messages");

            const chatData = {
                text: message,
                user: "Anonymous",
                timestamp: serverTimestamp()
            };

            try {
                const messagesCollection = collection(db, "questions", questionId, "messages")
                await addDoc(messagesCollection, chatData);

                chatMessages.append(`<div>${chatData.user}:${chatData.text}</div>`);
                input.val("");
            } catch (error) {
                console.error("メッセージの保存に失敗", error);
            }
        }
    });

    // 質問カードを取得して表示
    async function loadQuestions() {
        try {
            const querySnapshot = await getDocs(collection(db, "questions"));
            $("#save-area").empty();

            querySnapshot.forEach((doc) => {
                const data = doc.data();
                let tagHtml = (data.tags || []).map(tag => `<div class="tag">${tag}</div>`).join("");
                let card = `
                    <div class="card" data-id="${doc.id}">
                        <h3>${data.ask}</h3>
                        <p>${data.detail}</p>
                        <div>${tagHtml}</div>
                        <div class="chat-area">
                            <div class="chat-messages"></div>
                            <form class="chat-form">
                                <input type="text" placeholder="メッセージを入力..." class="chat-input">
                                <button type="submit">送信</button>
                            </form>
                        </div>
                        <button class="delete-button">削除</button>
                    </div>
                `;
                $("#save-area").append(card);
            });
            console.log("データ取得成功");

        } catch (error) {
            console.error("データ取得に失敗", error);
        }
    }

    $(function () {
        loadQuestions();
    });

    // 質問カードを完了にして削除
    $(document).on("click", ".delete-button", async function () {
        const card = $(this).closest(".card");
        const questionId = card.data("id");

        if (!questionId) {
            console.error("削除対象がみつからない");
            return;
        }

        if (confirm("削除してよろしいですか？")) {
            try {

                const docRef = doc(db, "questions", questionId);
                await deleteDoc(docRef);

                card.remove();
                console.log(`質問削除に成功：${questionId}`);
            } catch (error) {
                console.error("質問の削除に失敗", error);
            }
        }
    })
});




