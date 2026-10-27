workspace "Mountain Hut" "Web application that supports the activities of a mountain hut." {

    model {
        user = person "User" "Anyone who opens the public pages: the hut, the menus, the availability of tables."
        hiker = person "Hiker" "A registered user: books tables, changes and cancels bookings, joins the waiting list."
        employee = person "Employee" "A member of the hut team: defines slots and tables, reserves for hikers, monitors the occupancy."
        warden = person "Warden" "Manages the hut: does what an employee does, and also closes slots and cancels reservations."

        email = softwareSystem "Email service" "Delivers the emails of the hut: confirmations, news and offers from the waiting list." "External"

        hut = softwareSystem "Mountain Hut" "Lets hikers book tables and the hut team manage the service." {

            web = container "Web client" "Screens for every kind of user." "React, Vite" {
                webApp = component "App.jsx" "Mounts the app and holds the router, one route for each page." "React Router"
                webPages = component "pages/" "One screen per route." "React"
                webHooks = component "hooks/" "State, loading and errors of the screens." "React hooks"
                webComponents = component "components/" "Reusable pieces that draw their props." "React"
                webLib = component "lib/" "Pure formatting helpers." "JavaScript"
                webApi = component "api/" "The only place that calls the server." "fetch"
            }

            api = container "API application" "Business rules and REST API." "Node.js, Express" {
                apiApp = component "app.js" "Wires every piece together." "Express"
                apiRoutes = component "routes/" "Maps URLs to controllers." "Express Router"
                apiMiddleware = component "middleware/" "Finds out who is calling." "Express"
                apiControllers = component "controllers/" "Handle requests." "Express"
                apiDto = component "dto/" "Validates and shapes data." "JavaScript"
                apiUsecases = component "usecases/" "One per operation." "JavaScript"
                apiDomain = component "domain/" "Business rules." "JavaScript"
                apiDao = component "dao/" "SQL queries." "SQL"
                apiDb = component "dao/db.js" "Database access." "PostgreSQL driver"
                apiClock = component "clock.js" "Reads the date." "JavaScript"
                apiMailer = component "mailer.js" "Sends emails." "SMTP client"
                apiHasher = component "passwordHasher.js" "Hashes passwords." "node:crypto"
            }

            db = container "Database" "Users, sessions, slots, tables, bookings and waiting lists." "PostgreSQL" "Database"
        }

        user -> hut "Reads about the hut and checks the availability"
        hiker -> hut "Books tables and manages the bookings"
        employee -> hut "Manages slots, menus and reservations"
        warden -> hut "Manages the hut and closes slots"
        hut -> email "Sends emails" "SMTP"

        user -> web "Uses"
        hiker -> web "Uses"
        employee -> web "Uses"
        warden -> web "Uses"
        web -> api "Calls" "JSON/HTTP"
        api -> db "Reads, writes" "SQL"
        api -> email "Sends emails" "SMTP"

        web -> apiRoutes "Calls" "JSON/HTTP"
        apiApp -> apiRoutes "Mounts"
        apiRoutes -> apiMiddleware "Uses"
        apiRoutes -> apiControllers "Calls"
        apiControllers -> apiDto "Uses"
        apiControllers -> apiUsecases "Calls"
        apiUsecases -> apiDomain "Uses"
        apiUsecases -> apiDao "Calls"
        apiUsecases -> apiClock "Uses"
        apiUsecases -> apiMailer "Sends emails with"
        apiUsecases -> apiHasher "Uses"
        apiDao -> apiDb "Uses"
        apiDb -> db "Reads, writes" "SQL"
        apiMailer -> email "Sends emails" "SMTP"

        user -> webPages "Uses"
        hiker -> webPages "Uses"
        employee -> webPages "Uses"
        warden -> webPages "Uses"
        webApp -> webPages "Routes to"
        webPages -> webHooks "Uses"
        webPages -> webComponents "Draws with"
        webHooks -> webApi "Calls"
        webHooks -> webLib "Uses"
        webComponents -> webLib "Uses"
        webApi -> api "Calls" "JSON/HTTP"

        live = deploymentEnvironment "Docker" {
            deploymentNode "Visitor's device" "The phone or computer of a hiker, or of anyone who opens the public pages." "Web browser" {
                containerInstance web
            }
            deploymentNode "Employee's device" "A computer or a tablet used by an employee." "Web browser" {
                containerInstance web
            }
            deploymentNode "Warden's device" "A computer or a tablet used by the warden." "Web browser" {
                containerInstance web
            }
            deploymentNode "Docker host" "A server or a virtual machine." "Docker, Docker Compose" {
                deploymentNode "app" "Serves the API and the built web client." "Container, Node.js 22" {
                    containerInstance api
                }
                deploymentNode "db" "Keeps the data." "Container, PostgreSQL" {
                    dbInstance = containerInstance db
                    dataVolume = infrastructureNode "Data volume" "Keeps the data when the container is replaced." "Docker volume"
                    dbInstance -> dataVolume "Writes to"
                }
            }
            deploymentNode "Mail server" "Provided by the hut or by an email service." "SMTP" {
                softwareSystemInstance email
            }
        }
    }

    views {
        systemContext hut "Context" {
            include *
            autoLayout lr
        }

        container hut "Containers" {
            include *
            autoLayout lr
        }

        component api "BackendComponents" {
            include *
            include user hiker employee warden
            autoLayout tb
        }

        component web "FrontendComponents" {
            include *
            include user hiker employee warden db email
            autoLayout tb
        }

        deployment hut "Docker" "Deployment" {
            include *
            autoLayout lr
            title "Deployment View: Mountain Hut - Docker"
        }

        styles {
            element "Person" {
                shape person
                background #08427b
                color #ffffff
            }
            element "Software System" {
                background #1168bd
                color #ffffff
            }
            element "External" {
                background #999999
                color #ffffff
            }
            element "Container" {
                background #438dd5
                color #ffffff
            }
            element "Database" {
                shape cylinder
            }
            element "Component" {
                background #85bbf0
                color #000000
            }
        }
    }
}
