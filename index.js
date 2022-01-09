let child_process = require('child_process')
let projectjs = require('./projects.js')
let fs = require('fs')
let os = require('os')
let ejs = require('ejs');
let { getLinkPreview } = require("link-preview-js");
const { env } = require('process');

const NPMBuild = (env["NPMBUILD"] != "FALSE")

Main().then(() => { })

async function Main() {


    console.log('Bitdev showcase!')

    await Exec(`rm -rf ./build`)

    await Exec(`rm -rf ./repos`)
    await Exec(`mkdir -p ./repos`)

    await Exec(`cp -r ./public/ ./build/`)

    let authors = [] // People who write code
    let members = [] // All members
    let memberBuilds = []

    projectjs.members.forEach(rawmember => {

        memberBuilds.push(memberPreview())

        async function memberPreview() {
            let preview = await getLinkPreview("https://github.com/" + rawmember.github)

            let image
            if (preview.images && preview.images.length > 0) {
                image = preview.images[0]
            }

            let description
            if (preview.description) {
                description = preview.description.replace("\\n", " <br> ")
            }

            let member = {
                name: rawmember.name,
                username: rawmember.github,
                url: "https://github.com/" + rawmember.github,
                image: image,
                description: description,
                projects: []
            }

            members.push(member)

            authors.push({
                name: rawmember.github,
                projects: [],
                member: member
            })

            await Exec(`mkdir -p "./build/${member.username}/"`)

        }

    })

    await Promise.all(memberBuilds)


    let repoBuilds = []
    let repos = []

    projectjs.projects.forEach(proj => {

        try {
            repoBuilds.push(buildRepo())
        } catch (error) {
            console.log(error)

        }


        async function buildRepo() {

            let member = members.find(m => m.username == proj.author)
            let username = proj.author;
            if (member) {
                username = member.username
            }

            console.log(`Building "${proj.repo}"`)

            await Exec(`mkdir -p "./repos/${proj.repo}"`)

            if (NPMBuild) {

                await Exec(`cd "./repos/${proj.repo}/.." && git clone --depth 1 --single-branch https://github.com/${proj.repo}`)

                let packages = JSON.parse(fs.readFileSync(`./repos/${proj.repo}/package.json`))
                packages["homepage"] = `/${proj.repo}/`
                fs.writeFileSync(`./repos/${proj.repo}/package.json`, JSON.stringify(packages, null, 2))

                await Exec(`cd "./repos/${proj.repo}/" && npm install && npm run build`)

                await Exec(`mv "./repos/${proj.repo}/build/" "./build/${proj.repo}/"`)
            }

            let linkPreview = await getLinkPreview("https://github.com/" + proj.repo)



            let repo;

            if (linkPreview) {
                if (linkPreview.images && linkPreview.images.length > 0) {
                    repo = {
                        name: proj.name,
                        author: username,
                        title: linkPreview.title,
                        img: linkPreview.images[0],
                        url: proj.repo,
                        member: member

                    }
                } else {
                    repo = {
                        name: proj.name,
                        author: username,
                        title: linkPreview.title,
                        url: proj.repo,
                        member: member
                    }
                }
            } else {
                repo = {
                    name: proj.name,
                    author: username,
                    url: proj.repo,
                    member: member
                }
            }

            repos.push(repo)




            let authorExist = authors.find(author => author.name == username)
            if (!authorExist) {
                if (member) {
                    authors.push({
                        name: username,
                        projects: [repo],
                        member: member
                    })

                } else {
                    authors.push({
                        name: username,
                        projects: [repo]
                    })
                }


            } else {
                authors.find(author => author.name == username).projects.push(repo)
            }


        }
    });




    await Promise.all(repoBuilds)


    let authors_unique = [...new Set(authors)]


    ejs.renderFile("index.ejs", { "repos": repos, "members": members }, (err, str) => {
        fs.writeFileSync(`./build/index.html`, str)
    })

    authors_unique.forEach(author => {
        ejs.renderFile("author.ejs", { "author": author }, (err, str) => {
            let username = author.member ? author.member.username : author.name;
            // console.log(JSON.stringify(author, null, "\t"))
            fs.writeFileSync(`./build/${username}/index.html`, str)
        })
    })

}



// Excecute shell commands
function Exec(file) {
    var exec = child_process.exec

    return new Promise((resolve, reject) => {
        console.log("Executing: " + file)
        exec(file, function execcallback(error, stdout, stderr) {
            if (stdout) console.log(file + ': ' + stdout)
            if (stderr) console.log(file + ': Erro : ' + stderr)
            if (error) console.error(error)

            resolve()
        })
    })

}