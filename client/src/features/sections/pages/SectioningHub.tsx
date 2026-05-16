import { useState } from "react";
import { motion } from "motion/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { useNavigate } from "react-router";
import { BookOpen, Wrench } from "lucide-react";

/**
 * SectioningHub: Entry lobby for sectioning workspace.
 * Two pathways: Home Room Batching (Grades 7-10 academic) and TLE Track Sectioning (Grades 9-10 labs).
 * Route: /sectioning
 */
export default function SectioningHub() {
  const navigate = useNavigate();
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  const pathways = [
    {
      id: "home-room",
      title: "Home Room Batching",
      description: "Assign students to academic home rooms (Grades 7-10)",
      badge: "Academic",
      badgeColor: "bg-blue-500",
      icon: BookOpen,
      route: "/sectioning/home-room",
      color: "from-blue-50 to-blue-100",
    },
    {
      id: "tle",
      title: "TLE Track Sectioning",
      description: "Assign students to TLE laboratories (Grades 9-10)",
      badge: "TLE",
      badgeColor: "bg-amber-500",
      icon: Wrench,
      route: "/sectioning/tle",
      color: "from-amber-50 to-amber-100",
    },
  ];

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-12 text-center"
        >
          <h1 className="text-4xl font-bold text-foreground mb-3">Sectioning Hub</h1>
          <p className="text-lg text-muted-foreground">
            Select a pathway to manage student assignments
          </p>
        </motion.div>

        {/* Pathway Cards Grid */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 gap-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          {pathways.map((pathway, index) => {
            const IconComponent = pathway.icon;
            return (
              <motion.div
                key={pathway.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ scale: 1.02 }}
                transition={{ delay: 0.1 + index * 0.1, duration: 0.4 }}
                onMouseEnter={() => setHoveredCard(pathway.id)}
                onMouseLeave={() => setHoveredCard(null)}
              >
                <Card
                  className={`border-0 shadow-lg cursor-pointer transition-shadow duration-300 ${
                    hoveredCard === pathway.id ? "shadow-2xl" : "shadow-md"
                  }`}
                >
                  <div className={`bg-gradient-to-br ${pathway.color} h-32 flex items-center justify-center`}>
                    <motion.div
                      animate={hoveredCard === pathway.id ? { scale: 1.2 } : { scale: 1 }}
                      transition={{ duration: 0.3 }}
                    >
                      <IconComponent className="w-16 h-16 text-foreground/40" />
                    </motion.div>
                  </div>

                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <CardTitle className="text-xl text-foreground">
                          {pathway.title}
                        </CardTitle>
                        <CardDescription className="text-muted-foreground mt-1">
                          {pathway.description}
                        </CardDescription>
                      </div>
                      <Badge className={`${pathway.badgeColor} text-white whitespace-nowrap`}>
                        {pathway.badge}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-0">
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={hoveredCard === pathway.id ? { opacity: 1 } : { opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Button
                        onClick={() => navigate(pathway.route)}
                        className={`w-full ${
                          pathway.id === "home-room"
                            ? "bg-blue-600 hover:bg-blue-700"
                            : "bg-amber-600 hover:bg-amber-700"
                        }`}
                      >
                        Enter {pathway.title}
                      </Button>
                    </motion.div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Footer Note */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="mt-12 p-4 bg-primary/5 border border-primary/20 rounded-lg text-center"
        >
          <p className="text-sm text-foreground">
            ✓ All assignments follow DepEd regulations and school policies
          </p>
        </motion.div>
      </div>
    </div>
  );
}
